/**
 * CompilerSession —— 工程级编译会话：组合 pipeline（单文件编译）、
 * incremental（哈希缓存）与 dep-graph（级联重建），见 02 篇⑥。
 *
 * - `build()`：全量构建；
 * - `build(changedFiles)`：增量构建——变更文件（哈希判定）∪ 依赖图
 *   `dependentsOf` 传递闭包为重编译集合，其余文件直接复用缓存；
 * - 每次构建都会重算 app.js/app.json/app.wxss、注入 runtime、拷贝 assets
 *   （成本极低，且 app.json 的 pages 列表依赖全量 model 视图）。
 */

import { createRequire } from 'node:module';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import type { Diagnostic } from '@arkmp/diagnostics';
import { errorDiagnostic, warningDiagnostic } from '@arkmp/diagnostics';
import { IncrementalCache } from '@arkmp/incremental';
import type { ComponentModel } from '@arkmp/ir';
import { compile } from '@arkmp/pipeline';
import type { CompileOptions } from '@arkmp/pipeline';
import { createConsoleLogger, normalizePath } from '@arkmp/shared';
import type { Logger } from '@arkmp/shared';
import {
  COMPILER_DIAGNOSTIC_CODES,
  buildAppJs,
  buildAppJson,
  buildAppWxss,
  buildProjectConfig,
  mergeUsingComponents,
} from './app-files';
import type { TabBarOptions } from './app-files';
import { kebabCase, outputBaseFor, relativeRuntimeRequire, usingComponentPath } from './paths';
import { buildProviderIndex, collectCustomComponentRefs } from './refs';

/** 工程级编译配置（普通对象，对齐 07 篇 arkmp.config.ts 字段；config 文件加载是 P7 @arkmp/config 的职责）。 */
export interface CompileProjectOptions {
  /** 工程根目录（含 src/） */
  rootDir: string;
  /** 源码目录（相对 rootDir），默认 `src` */
  srcDir?: string;
  /** 产物目录（相对 rootDir），默认 `dist` */
  outDir?: string;
  /** 小程序 appId（存在时生成 project.config.json） */
  appId?: string;
  /** 应用名（project.config.json 的 projectname） */
  appName?: string;
  /** 全局窗口配置 → app.json.window */
  window?: Record<string, unknown>;
  /** tabBar 配置（pages 按页面 struct 名引用）→ app.json.tabBar */
  tabBar?: TabBarOptions;
  /** 权限声明 → app.json.permission */
  permission?: Record<string, unknown>;
  /** 透传 @arkmp/pipeline 的单文件编译选项 */
  compile?: Pick<CompileOptions, 'unitRatio' | 'classPrefix' | 'sourcemap'>;
  /** 日志（默认 console logger） */
  logger?: Logger;
}

/** 一次构建的结果。 */
export interface BuildResult {
  /** 写入产物文件数量 */
  files: number;
  /** 全量诊断（各文件编译诊断 + 工程级诊断汇总） */
  diagnostics: Diagnostic[];
  /** 是否存在 error 级诊断 */
  hasErrors: boolean;
  /** 本次实际重编译的 .ets（src 相对 posix 路径，排序） */
  rebuilt: string[];
  /** 本次写入的产物（outDir 相对 posix 路径，排序） */
  written: string[];
}

const RUNTIME_REQUIRE = "require('@arkmp/runtime')";

/** 递归列出目录下全部 .ets（返回 src 相对 posix 路径，排序）。 */
function scanEtsFiles(absSrc: string): string[] {
  const result: string[] = [];
  const walk = (dir: string, rel: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const relPath = rel === '' ? entry : `${rel}/${entry}`;
      if (statSync(full).isDirectory()) {
        walk(full, relPath);
      } else if (entry.endsWith('.ets')) {
        result.push(relPath);
      }
    }
  };
  walk(absSrc, '');
  return result.sort();
}

/** 递归拷贝目录（保留相对结构），返回拷贝出的目标相对路径。 */
function copyDirRecursive(absFrom: string, absTo: string, relPrefix: string): string[] {
  const written: string[] = [];
  const walk = (dir: string, rel: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const relPath = rel === '' ? entry : `${rel}/${entry}`;
      if (statSync(full).isDirectory()) {
        walk(full, relPath);
      } else {
        const target = join(absTo, relPath);
        mkdirSync(dirname(target), { recursive: true });
        copyFileSync(full, target);
        written.push(normalizePath(`${relPrefix}/${relPath}`));
      }
    }
  };
  walk(absFrom, '');
  return written;
}

/** 定位 @arkmp/runtime 的单文件产物 dist/runtime.js。 */
function resolveRuntimeJs(): string | undefined {
  try {
    const require = createRequire(import.meta.url);
    const entry = require.resolve('@arkmp/runtime'); // → dist/index.cjs
    const runtimeJs = join(dirname(entry), 'runtime.js');
    return existsSync(runtimeJs) ? runtimeJs : undefined;
  } catch {
    return undefined;
  }
}

export class CompilerSession {
  private readonly options: CompileProjectOptions;
  private readonly logger: Logger;
  private readonly cache = new IncrementalCache();
  /** src 相对路径 → 最新 ComponentModel（app.json pages 列表的全量视图来源） */
  private readonly models = new Map<string, ComponentModel>();
  /** src 相对路径 → 该源文件写出的产物（outDir 相对路径），删除源文件时用于清理 */
  private readonly outputsBySource = new Map<string, string[]>();

  constructor(options: CompileProjectOptions) {
    this.options = options;
    this.logger = options.logger ?? createConsoleLogger('warn');
  }

  private get absSrc(): string {
    return join(this.options.rootDir, this.options.srcDir ?? 'src');
  }

  private get absOut(): string {
    return join(this.options.rootDir, this.options.outDir ?? 'dist');
  }

  /**
   * 构建。`changedFiles` 缺省为全量；传入时为增量（src 相对 posix 路径，
   * 已删除的文件也算变更——其产物会被清理，引用方级联重建）。
   */
  async build(changedFiles?: readonly string[]): Promise<BuildResult> {
    const diagnostics: Diagnostic[] = [];
    const written: string[] = [];

    // ① 扫描源码
    const scanned = scanEtsFiles(this.absSrc);
    const scannedSet = new Set(scanned);
    const compilable = scanned.filter((f) => f === 'app.ets' || f.startsWith('pages/') || f.startsWith('components/'));
    for (const skipped of scanned.filter((f) => !compilable.includes(f))) {
      diagnostics.push(
        warningDiagnostic(
          COMPILER_DIAGNOSTIC_CODES.SKIPPED_SOURCE,
          `不属于 app/pages/components 的源文件已跳过：${skipped}`,
          { file: skipped },
        ),
      );
    }
    const sourceFiles = compilable.filter((f) => f !== 'app.ets');

    // ② 确定重编译集合
    let rebuildSet: Set<string>;
    const staleOutputs: string[] = [];
    if (changedFiles === undefined || this.models.size === 0) {
      rebuildSet = new Set(sourceFiles);
    } else {
      const deleted = changedFiles.filter((f) => !scannedSet.has(f));
      const presentChanged = changedFiles.filter((f) => scannedSet.has(f));
      // 哈希未变的文件不算真正变更（touch 不触发重编）
      const reallyChanged = presentChanged.filter(
        (f) => this.cache.get(f, readFileSync(join(this.absSrc, f), 'utf8')) === undefined,
      );
      // 删除文件的引用方也要级联（在 remove 前取 dependentsOf）
      const deletedDependents = deleted.flatMap((f) => this.cache.graph.dependentsOf(f));
      rebuildSet = new Set(this.cache.invalidate([...reallyChanged, ...deletedDependents]));
      for (const f of deleted) {
        staleOutputs.push(...(this.outputsBySource.get(f) ?? []));
        this.cache.remove(f);
        this.models.delete(f);
        this.outputsBySource.delete(f);
      }
    }
    const rebuildFiles = [...rebuildSet]
      .filter((f) => sourceFiles.includes(f))
      .sort();

    // ③ 重编译（pipeline 单文件编译，fileName 用源路径保证诊断与 sourcemap 指回 .ets）
    const providerIndex = buildProviderIndex(sourceFiles);
    for (const file of rebuildFiles) {
      const source = readFileSync(join(this.absSrc, file), 'utf8');
      const result = compile(source, { fileName: file, ...this.options.compile });
      diagnostics.push(...result.diagnostics);

      const model = result.model;
      this.models.set(file, model);
      const outputBase = outputBaseFor(file);
      const sourceBase = file.replace(/\.ets$/u, '');

      // 依赖边 + usingComponents：自定义组件名 → 提供方文件
      const deps: string[] = [];
      const usingComponents: Record<string, string> = {};
      for (const ref of collectCustomComponentRefs(model)) {
        const provider = providerIndex.get(ref);
        if (provider === undefined) {
          diagnostics.push(
            warningDiagnostic(
              COMPILER_DIAGNOSTIC_CODES.COMPONENT_PROVIDER_NOT_FOUND,
              `未找到自定义组件 ${ref} 的提供方文件（约定：components/${ref}.ets）`,
              { file },
            ),
          );
          continue;
        }
        deps.push(provider);
        usingComponents[kebabCase(ref)] = usingComponentPath(provider, outputBase);
      }
      this.cache.update(file, source, model, deps);

      // 产物落盘：路径小写/kebab 化、js 的 runtime require 改写为相对路径、json 合并 usingComponents
      const outputs: string[] = [];
      for (const emitted of result.files) {
        let outPath = emitted.path.replace(sourceBase, outputBase);
        let content = emitted.content;
        if (outPath.endsWith('.js')) {
          content = content.split(RUNTIME_REQUIRE).join(`require('${relativeRuntimeRequire(outPath)}')`);
        } else if (outPath.endsWith('.json') && Object.keys(usingComponents).length > 0) {
          content = mergeUsingComponents(content, usingComponents);
        }
        this.writeFile(outPath, content);
        outputs.push(outPath);
        written.push(outPath);
      }
      this.outputsBySource.set(file, outputs);
    }

    // ④ 清理已删除源文件的产物
    for (const stale of staleOutputs) {
      rmSync(join(this.absOut, stale), { force: true });
    }

    // ⑤ app 级产物（每次构建重算：pages 列表依赖全量 model 视图）
    const appArtifacts = this.buildAppArtifacts(diagnostics);
    written.push(...appArtifacts);

    // ⑥ runtime 注入：dist/arkmp/runtime.js
    const runtimeJs = resolveRuntimeJs();
    if (runtimeJs === undefined) {
      diagnostics.push(
        errorDiagnostic(
          COMPILER_DIAGNOSTIC_CODES.RUNTIME_NOT_FOUND,
          '未找到 @arkmp/runtime 的单文件产物 dist/runtime.js（请先构建 runtime 包）',
        ),
      );
    } else {
      const target = join(this.absOut, 'arkmp/runtime.js');
      mkdirSync(dirname(target), { recursive: true });
      copyFileSync(runtimeJs, target);
      written.push('arkmp/runtime.js');
    }

    // ⑦ 资源拷贝：src/resources/media/** → dist/assets/**
    const mediaDir = join(this.absSrc, 'resources/media');
    if (existsSync(mediaDir)) {
      written.push(...copyDirRecursive(mediaDir, join(this.absOut, 'assets'), 'assets'));
    }

    const sortedWritten = [...new Set(written)].sort();
    return {
      files: sortedWritten.length,
      diagnostics,
      hasErrors: diagnostics.some((d) => d.level === 'error'),
      rebuilt: rebuildFiles,
      written: sortedWritten,
    };
  }

  /** app.js / app.wxss / app.json / project.config.json（appId 存在时）。 */
  private buildAppArtifacts(diagnostics: Diagnostic[]): string[] {
    const written: string[] = [];
    const entryPages = [...this.models.entries()]
      .filter(([file, model]) => file.startsWith('pages/') && model.isEntry)
      .sort(([a], [b]) => a.localeCompare(b));
    const pageRoutes = entryPages.map(([file]) => outputBaseFor(file));
    const routeByName = new Map(entryPages.map(([file, model]) => [model.name, outputBaseFor(file)]));

    const appJson = buildAppJson({
      pageRoutes,
      routeByName,
      ...(this.options.window !== undefined ? { window: this.options.window } : {}),
      ...(this.options.tabBar !== undefined ? { tabBar: this.options.tabBar } : {}),
      ...(this.options.permission !== undefined ? { permission: this.options.permission } : {}),
    });
    diagnostics.push(...appJson.diagnostics);

    this.writeFile('app.js', buildAppJs());
    this.writeFile('app.wxss', buildAppWxss());
    this.writeFile('app.json', `${JSON.stringify(appJson.json, null, 2)}\n`);
    written.push('app.js', 'app.wxss', 'app.json');

    if (this.options.appId !== undefined) {
      const config = buildProjectConfig(this.options.appId, this.options.appName);
      this.writeFile('project.config.json', `${JSON.stringify(config, null, 2)}\n`);
      written.push('project.config.json');
    }
    return written;
  }

  private writeFile(outRelative: string, content: string): void {
    const target = join(this.absOut, outRelative);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
  }
}
