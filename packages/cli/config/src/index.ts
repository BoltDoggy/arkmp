/**
 * @arkmp/config —— L7 `arkmp.config.ts` 加载、schema 校验与默认值合并（07 篇）。
 *
 * - `defineConfig(config)`：恒等函数，仅作类型辅助（配置文件里获得字段提示）；
 * - `loadConfig(cwd?)`：查找并加载 `arkmp.config.ts`——用 TypeScript 转译为 CJS
 *   后在沙箱内求值（`require('@arkmp/cli')` / `require('@arkmp/config')` 由内置
 *   shim 提供 `defineConfig`，其余 import 报诊断），再按 schema 校验并与默认值合并；
 * - 找不到配置文件时返回默认值（无诊断）。
 *
 * 默认值合并策略（docstring 约定）：
 * - 顶层标量字段（appId/appName）：用户缺省即为 `undefined`（不生成对应产物）；
 * - `compile`：按字段浅合并——用户值覆盖默认值
 *   （`unitRatio: 2`、`sourcemap: false`、`minify: false`；`classPrefix` 无默认值，
 *   未设置时透传 `undefined`，由 @arkmp/pipeline 使用其内置前缀）；
 * - `window` / `permission`：透传型对象，存在即原样采用（不做深合并）；
 * - `tabBar` / `devServer`：存在即整体采用；
 * - 类型非法的字段：报 error 诊断并回落到默认值（视为未设置）；
 * - 未知字段：报 warning 诊断并忽略。
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { errorDiagnostic, warningDiagnostic } from '@arkmp/diagnostics';
import type { Diagnostic } from '@arkmp/diagnostics';

/** config 包诊断码。 */
export const CONFIG_DIAGNOSTIC_CODES = {
  /** 配置文件存在但加载/求值失败 */
  LOAD_FAILED: 'E7001',
  /** 配置整体不是对象 */
  NOT_AN_OBJECT: 'E7002',
  /** 字段类型非法（回落默认值） */
  INVALID_FIELD: 'E7003',
  /** 未知字段（忽略） */
  UNKNOWN_FIELD: 'W7001',
} as const;

/** `compile` 段配置（对齐 07 篇 arkmp.config.ts）。 */
export interface CompileConfig {
  /** vp → rpx 换算系数，默认 2 */
  unitRatio?: number;
  /** js 产物 sourcemap，默认 false */
  sourcemap?: boolean;
  /** 构建时压缩，默认 false（当前版本暂未实现，开启时 CLI 告警并忽略） */
  minify?: boolean;
  /** 样式类名前缀（多工程共存时防冲突），未设置时用编译器内置前缀 */
  classPrefix?: string;
}

/** tabBar 配置：pages 按页面 struct 名引用（→ app.json.tabBar）。 */
export interface TabBarConfig {
  pages: Array<{ name: string; text: string; icon?: string }>;
}

/** dev 模式配置。 */
export interface DevServerConfig {
  /** dev 时自动唤起微信开发者工具，默认 false */
  autoOpenDevtool?: boolean;
  /** 开发者工具安装路径（macOS 默认 /Applications/wechatwebdevtools.app） */
  devtoolPath?: string;
}

/** arkmp.config.ts 的用户配置形态（全部字段可选）。 */
export interface ArkmpConfig {
  /** 小程序 appId（存在时生成 project.config.json） */
  appId?: string;
  /** 应用名（project.config.json 的 projectname） */
  appName?: string;
  compile?: CompileConfig;
  /** 全局窗口配置 → app.json.window */
  window?: Record<string, unknown>;
  tabBar?: TabBarConfig;
  /** 权限声明 → app.json.permission */
  permission?: Record<string, unknown>;
  devServer?: DevServerConfig;
}

/** 合并默认值后的配置：compile 段必填字段已补齐。 */
export interface ResolvedConfig extends Omit<ArkmpConfig, 'compile'> {
  compile: Required<Pick<CompileConfig, 'unitRatio' | 'sourcemap' | 'minify'>> &
    Pick<CompileConfig, 'classPrefix'>;
}

/** loadConfig 返回值。 */
export interface LoadConfigResult {
  /** 校验 + 默认值合并后的配置 */
  config: ResolvedConfig;
  /** 配置文件绝对路径；未找到为 undefined */
  path?: string;
  /** 加载与校验诊断（类型非法为 error，未知字段为 warning） */
  diagnostics: Diagnostic[];
}

/**
 * 类型辅助：恒等返回入参。配置文件中的 `defineConfig({...})` 只为获得类型提示。
 */
export function defineConfig(config: ArkmpConfig): ArkmpConfig {
  return config;
}

/** 默认值（见文件头「默认值合并策略」）。 */
export const DEFAULT_CONFIG: ResolvedConfig = {
  compile: { unitRatio: 2, sourcemap: false, minify: false },
};

/** 生成一份默认配置副本（避免调用方意外改写共享的 DEFAULT_CONFIG）。 */
function defaultConfig(): ResolvedConfig {
  return { compile: { ...DEFAULT_CONFIG.compile } };
}

const CONFIG_FILE = 'arkmp.config.ts';

const TOP_LEVEL_KEYS = ['appId', 'appName', 'compile', 'window', 'tabBar', 'permission', 'devServer'];
const COMPILE_KEYS = ['unitRatio', 'sourcemap', 'minify', 'classPrefix'];
const DEV_SERVER_KEYS = ['autoOpenDevtool', 'devtoolPath'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function reportUnknownKeys(
  obj: Record<string, unknown>,
  known: readonly string[],
  section: string,
  diagnostics: Diagnostic[],
): void {
  for (const key of Object.keys(obj)) {
    if (!known.includes(key)) {
      diagnostics.push(
        warningDiagnostic(CONFIG_DIAGNOSTIC_CODES.UNKNOWN_FIELD, `未知配置字段已忽略：${section}${key}`),
      );
    }
  }
}

type FieldType = 'string' | 'boolean' | 'number' | 'object';

function checkType(value: unknown, type: FieldType): boolean {
  switch (type) {
    case 'string':
      return typeof value === 'string';
    case 'boolean':
      return typeof value === 'boolean';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'object':
      return isRecord(value);
  }
}

/**
 * 校验并合并用户配置。非法字段报 error 并回落默认值；未知字段报 warning 并忽略。
 */
export function resolveConfig(raw: unknown): { config: ResolvedConfig; diagnostics: Diagnostic[] } {
  const diagnostics: Diagnostic[] = [];
  if (raw === undefined || raw === null) {
    return { config: defaultConfig(), diagnostics };
  }
  if (!isRecord(raw)) {
    diagnostics.push(
      errorDiagnostic(CONFIG_DIAGNOSTIC_CODES.NOT_AN_OBJECT, 'arkmp.config.ts 的默认导出必须是配置对象'),
    );
    return { config: defaultConfig(), diagnostics };
  }

  reportUnknownKeys(raw, TOP_LEVEL_KEYS, '', diagnostics);

  const invalid = (field: string, expected: string): void => {
    diagnostics.push(
      errorDiagnostic(
        CONFIG_DIAGNOSTIC_CODES.INVALID_FIELD,
        `配置字段类型非法，已回落默认值：${field}（期望 ${expected}）`,
      ),
    );
  };

  const config: ResolvedConfig = defaultConfig();

  for (const key of ['appId', 'appName'] as const) {
    if (raw[key] === undefined) continue;
    if (typeof raw[key] === 'string') config[key] = raw[key];
    else invalid(key, 'string');
  }

  if (raw.compile !== undefined) {
    if (!isRecord(raw.compile)) {
      invalid('compile', 'object');
    } else {
      reportUnknownKeys(raw.compile, COMPILE_KEYS, 'compile.', diagnostics);
      const src = raw.compile;
      const mergeField = <K extends keyof CompileConfig>(key: K, type: FieldType, expected: string): void => {
        if (src[key] === undefined) return;
        if (checkType(src[key], type)) {
          (config.compile as Record<string, unknown>)[key] = src[key];
        } else {
          invalid(`compile.${key}`, expected);
        }
      };
      mergeField('unitRatio', 'number', 'number');
      mergeField('sourcemap', 'boolean', 'boolean');
      mergeField('minify', 'boolean', 'boolean');
      mergeField('classPrefix', 'string', 'string');
    }
  }

  for (const key of ['window', 'permission'] as const) {
    if (raw[key] === undefined) continue;
    if (isRecord(raw[key])) config[key] = raw[key];
    else invalid(key, 'object');
  }

  if (raw.tabBar !== undefined) {
    const tabBar = raw.tabBar;
    const validPages =
      isRecord(tabBar) &&
      Array.isArray(tabBar.pages) &&
      tabBar.pages.every(
        (p) =>
          isRecord(p) &&
          typeof p.name === 'string' &&
          typeof p.text === 'string' &&
          (p.icon === undefined || typeof p.icon === 'string'),
      );
    if (validPages) {
      config.tabBar = tabBar as unknown as TabBarConfig;
    } else {
      invalid('tabBar', '{ pages: Array<{ name: string; text: string; icon?: string }> }');
    }
  }

  if (raw.devServer !== undefined) {
    if (!isRecord(raw.devServer)) {
      invalid('devServer', 'object');
    } else {
      reportUnknownKeys(raw.devServer, DEV_SERVER_KEYS, 'devServer.', diagnostics);
      const devServer: DevServerConfig = {};
      if (raw.devServer.autoOpenDevtool !== undefined) {
        if (typeof raw.devServer.autoOpenDevtool === 'boolean') {
          devServer.autoOpenDevtool = raw.devServer.autoOpenDevtool;
        } else {
          invalid('devServer.autoOpenDevtool', 'boolean');
        }
      }
      if (raw.devServer.devtoolPath !== undefined) {
        if (typeof raw.devServer.devtoolPath === 'string') {
          devServer.devtoolPath = raw.devServer.devtoolPath;
        } else {
          invalid('devServer.devtoolPath', 'string');
        }
      }
      config.devServer = devServer;
    }
  }

  return { config, diagnostics };
}

/**
 * 转译并求值 arkmp.config.ts，返回其默认导出。
 * `require` 仅支持 '@arkmp/cli' / '@arkmp/config'（提供 defineConfig），其余抛错。
 */
function evaluateConfigFile(absPath: string): unknown {
  const source = readFileSync(absPath, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: CONFIG_FILE,
  });
  const shimRequire = (id: string): unknown => {
    if (id === '@arkmp/cli' || id === '@arkmp/config') {
      return { defineConfig };
    }
    throw new Error(`配置文件仅支持从 '@arkmp/cli' 导入 defineConfig，不支持导入：${id}`);
  };
  const module = { exports: {} as Record<string, unknown> };
  const fn = new Function('module', 'exports', 'require', outputText) as (
    module: { exports: Record<string, unknown> },
    exports: Record<string, unknown>,
    require: (id: string) => unknown,
  ) => void;
  fn(module, module.exports, shimRequire);
  return module.exports.default ?? module.exports;
}

/**
 * 加载 `cwd/arkmp.config.ts`：求值 → schema 校验 → 默认值合并。
 * 找不到配置文件时返回默认值（diagnostics 为空）。
 */
export function loadConfig(cwd: string = process.cwd()): LoadConfigResult {
  const absPath = join(cwd, CONFIG_FILE);
  if (!existsSync(absPath)) {
    return { config: defaultConfig(), diagnostics: [] };
  }

  let raw: unknown;
  try {
    raw = evaluateConfigFile(absPath);
  } catch (error) {
    return {
      config: defaultConfig(),
      path: absPath,
      diagnostics: [
        errorDiagnostic(
          CONFIG_DIAGNOSTIC_CODES.LOAD_FAILED,
          `加载 ${CONFIG_FILE} 失败：${error instanceof Error ? error.message : String(error)}`,
          { file: CONFIG_FILE },
        ),
      ],
    };
  }

  const { config, diagnostics } = resolveConfig(raw);
  return { config, path: absPath, diagnostics };
}
