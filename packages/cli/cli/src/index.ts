/**
 * @arkmp/cli —— L7 命令行入口（对外发布包，`bin: ark-mp`）。
 *
 * 基于 `cac` 解析命令，编排各内部包实现 07 篇定义的命令：
 *
 * - `ark-mp init <name> [--template demo]`  → @arkmp/templates
 * - `ark-mp build`                           → @arkmp/config + @arkmp/compiler
 * - `ark-mp dev`                             → watch session + @arkmp/devtool
 * - `ark-mp compile <file> --out <dir>`      → @arkmp/pipeline（单文件模式）
 * - `ark-mp check <dir>`                     → 只诊断不产出
 * - `ark-mp preview / upload`                → @arkmp/devtool（miniprogram-ci）
 * - `ark-mp doctor`                          → 环境检查
 *
 * `createApp()` 返回 cac 实例（不自动解析 argv），供测试注入参数；
 * `run(argv)` 是 bin 入口（解析 argv → 执行命令 → exit code）。
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import cac from 'cac';
import type { CAC } from 'cac';
import { loadConfig } from '@arkmp/config';
import type { ResolvedConfig } from '@arkmp/config';
import { buildProject, createWatchSession } from '@arkmp/compiler';
import { compile } from '@arkmp/pipeline';
import { formatDiagnostic } from '@arkmp/diagnostics';
import type { Diagnostic } from '@arkmp/diagnostics';
import { renderTemplate } from '@arkmp/templates';
import type { TemplateName } from '@arkmp/templates';
import { openDevtool, preview, upload, resolveDevtoolCli } from '@arkmp/devtool';
import { normalizePath } from '@arkmp/shared';

/** CLI 包诊断码。 */
export const CLI_DIAGNOSTIC_CODES = {
  /** 源文件不存在 */
  FILE_NOT_FOUND: 'E8001',
  /** runtime 单文件产物定位失败 */
  RUNTIME_NOT_FOUND: 'E8002',
} as const;

/** 命令执行结果。 */
export interface CommandResult {
  code: number;
  diagnostics: Diagnostic[];
  message?: string;
}

const success = (): CommandResult => ({ code: 0, diagnostics: [] });
const fail = (message: string, ...diagnostics: Diagnostic[]): CommandResult => ({
  code: 1,
  message,
  diagnostics,
});

/** 打印诊断到 stderr。 */
export function printDiagnostics(diagnostics: Diagnostic[]): void {
  for (const d of diagnostics) {
    process.stderr.write(formatDiagnostic(d) + '\n');
  }
}

// ── init ──

interface InitOptions {
  template?: string;
}

async function initCommand(name: string, opts: InitOptions): Promise<CommandResult> {
  const template = (opts.template ?? 'default') as TemplateName;
  if (template !== 'default' && template !== 'demo') {
    return fail(`未知模板：${template}（可选：default, demo）`);
  }
  const targetDir = resolve(process.cwd(), name);
  if (existsSync(targetDir)) {
    return fail(`目标目录已存在：${targetDir}`);
  }
  const written = renderTemplate(template, targetDir, { projectName: name });
  return { code: 0, diagnostics: [], message: `已创建工程 ${name}（${written.length} 个文件）→ ${targetDir}` };
}

// ── build ──

async function buildCommand(): Promise<CommandResult> {
  const { config, diagnostics: configDiag } = loadConfig();
  if (configDiag.length > 0) printDiagnostics(configDiag);
  if (configDiag.some((d) => d.level === 'error')) {
    return fail('配置文件有误，构建终止');
  }
  const result = await buildProject(toCompilerOptions(config));
  printDiagnostics(result.diagnostics);
  if (result.hasErrors) return fail('构建失败（存在 error 级诊断）');
  return { code: 0, diagnostics: [], message: `构建完成：${result.files} 个产物文件` };
}

// ── dev ──

async function devCommand(): Promise<CommandResult> {
  const { config, diagnostics: configDiag } = loadConfig();
  if (configDiag.length > 0) printDiagnostics(configDiag);
  if (configDiag.some((d) => d.level === 'error')) {
    return fail('配置文件有误，开发终止');
  }
  const session = createWatchSession({
    ...toCompilerOptions(config),
    watch: { debounceMs: 50 },
  });
  const cwd = process.cwd();
  const distPath = join(cwd, (config as unknown as Record<string, unknown>).outDir as string | undefined ?? DEFAULT_OUT_DIR);

  process.stdout.write('ark-mp dev：启动 watch 编译...\n');
  const first = await session.start((result) => {
    printDiagnostics(result.diagnostics);
    process.stdout.write(`[ark-mp] 增量构建完成：${result.written.length} 个文件\n`);
  });
  printDiagnostics(first.diagnostics);

  // 首次构建后唤起开发者工具
  if (config.devServer?.autoOpenDevtool) {
    const res = openDevtool(distPath, { devtoolPath: config.devServer.devtoolPath });
    if (!res.ok) {
      printDiagnostics(res.diagnostics);
    }
  }

  return success();
}

// ── compile（单文件模式） ──

interface CompileOptions {
  out?: string;
  runtimePath?: string;
}

async function compileCommand(file: string, opts: CompileOptions): Promise<CommandResult> {
  const absFile = resolve(process.cwd(), file);
  if (!existsSync(absFile)) {
    return fail(`源文件不存在：${absFile}`);
  }
  const outDir = resolve(process.cwd(), opts.out ?? '.');
  mkdirSync(outDir, { recursive: true });

  const source = readFileSync(absFile, 'utf8');
  const result = compile(source, { fileName: file, sourcemap: true });
  printDiagnostics(result.diagnostics);

  const base = file.replace(/\.ets$/, '');
  for (const f of result.files) {
    const outPath = join(outDir, f.path);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, f.content);
  }

  // 拷贝 runtime 单文件
  const runtimeFile = resolveRuntimePath(opts.runtimePath);
  if (runtimeFile) {
    writeFileSync(join(outDir, 'runtime.js'), readFileSync(runtimeFile, 'utf8'));
  }

  if (result.hasErrors) return fail('编译存在 error');
  return { code: 0, diagnostics: [], message: `单文件编译完成：${result.files.length} 个产物 → ${outDir}` };
}

// ── check（只诊断不产出） ──

async function checkCommand(dir: string): Promise<CommandResult> {
  const absDir = resolve(process.cwd(), dir);
  if (!existsSync(absDir)) {
    return fail(`目录不存在：${absDir}`);
  }
  // 直接遍历 .ets 文件逐一编译，只收集诊断
  const allDiag: Diagnostic[] = [];
  const files = listEtsFiles(absDir);
  for (const f of files) {
    const source = readFileSync(f, 'utf8');
    const rel = normalizePath(f.slice(absDir.length + 1));
    const result = compile(source, { fileName: rel });
    allDiag.push(...result.diagnostics);
  }
  printDiagnostics(allDiag);
  if (allDiag.some((d) => d.level === 'error')) {
    return fail(`检查完成，存在 error 级诊断（${allDiag.filter((d) => d.level === 'error').length} 个）`);
  }
  return { code: 0, diagnostics: [], message: `检查通过：${files.length} 个 .ets 文件，0 error` };
}

// ── preview / upload ──

interface PreviewOptions {
  appid?: string;
  desc?: string;
  'private-key'?: string;
}

async function previewCommand(opts: PreviewOptions): Promise<CommandResult> {
  const { config } = loadConfig();
  const appId = opts.appid ?? config.appId;
  if (!appId) return fail('preview 需要 appId（通过 --appid 或 arkmp.config.ts 提供）');
  const distPath = join(process.cwd(), (config as unknown as Record<string, unknown>).outDir as string | undefined ?? DEFAULT_OUT_DIR);
  const res = await preview({
    projectPath: distPath,
    appId,
    desc: opts.desc,
    privateKeyPath: opts['private-key'],
  });
  if (!res.ok) {
    printDiagnostics(res.diagnostics);
    return fail('预览失败');
  }
  return { code: 0, diagnostics: [], message: '预览二维码已生成' };
}

interface UploadOptions {
  version: string;
  appid?: string;
  desc?: string;
  'private-key'?: string;
  robot?: number;
}

async function uploadCommand(opts: UploadOptions): Promise<CommandResult> {
  const { config } = loadConfig();
  const appId = opts.appid ?? config.appId;
  if (!appId) return fail('upload 需要 appId');
  if (!opts.version) return fail('upload 需要 --version');
  const distPath = join(process.cwd(), (config as unknown as Record<string, unknown>).outDir as string | undefined ?? DEFAULT_OUT_DIR);
  const res = await upload({
    projectPath: distPath,
    appId,
    version: opts.version,
    desc: opts.desc,
    robot: opts.robot,
    privateKeyPath: opts['private-key'],
  });
  if (!res.ok) {
    printDiagnostics(res.diagnostics);
    return fail('上传失败');
  }
  return { code: 0, diagnostics: [], message: `代码已上传：v${opts.version}` };
}

// ── doctor ──

async function doctorCommand(): Promise<CommandResult> {
  const results: Array<[string, boolean, string]> = [];
  const nodeVersion = process.versions.node;
  const nodeMajor = Number(nodeVersion.split('.')[0]);
  results.push(['Node.js', nodeMajor >= 18, `v${nodeVersion}`]);

  // 开发者工具
  const { config } = loadConfig();
  const devRes = resolveDevtoolCli(config.devServer?.devtoolPath);
  results.push(['微信开发者工具 CLI', devRes.cli !== undefined, devRes.cli ?? devRes.diagnostic?.message ?? '未找到']);

  // appId
  results.push(['appId 配置', config.appId !== undefined, config.appId ?? '未配置']);

  // 输出
  for (const [name, ok, detail] of results) {
    process.stdout.write(`  ${ok ? '✓' : '✗'} ${name}: ${detail}\n`);
  }
  return success();
}

// ── 辅助 ──

/** 默认产物目录名。 */
const DEFAULT_OUT_DIR = 'dist';

function toCompilerOptions(config: ResolvedConfig) {
  const opts: Record<string, unknown> = config as unknown as Record<string, unknown>;
  return {
    rootDir: process.cwd(),
    outDir: (opts.outDir as string | undefined) ?? DEFAULT_OUT_DIR,
    appId: config.appId,
    appName: config.appName,
    window: config.window,
    tabBar: config.tabBar,
    permission: config.permission,
    compile: {
      unitRatio: config.compile.unitRatio,
      classPrefix: config.compile.classPrefix,
      sourcemap: config.compile.sourcemap,
    },
  } as Parameters<typeof buildProject>[0];
}

function listEtsFiles(dir: string): string[] {
  const result: string[] = [];
  const walk = (d: string): void => {
    const entries = readdirSync(d, { withFileTypes: true });
    for (const e of entries) {
      const full = join(d, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith('.ets')) result.push(full);
    }
  };
  walk(dir);
  return result.sort();
}

function resolveRuntimePath(explicit?: string): string | undefined {
  if (explicit && existsSync(explicit)) return explicit;
  try {
    const require = createRequire(import.meta.url);
    const runtimeDist = require.resolve('@arkmp/runtime');
    // resolve 指向 dist/index.mjs 或 .cjs，单文件在同目录下
    const dir = dirname(runtimeDist);
    const singleFile = join(dir, 'runtime.js');
    if (existsSync(singleFile)) return singleFile;
  } catch {
    // runtime 未安装
  }
  return undefined;
}

// ── 构造 cac 实例 ──

/** 版本号（从 package.json 读取，fallback 0.1.0）。 */
function getVersion(): string {
  try {
    const require = createRequire(import.meta.url);
    return require('../../package.json').version ?? '0.1.0';
  } catch {
    return '0.1.0';
  }
}

/** 包装命令 action：捕获返回值，写入 output + 设置 exitCode。 */
function wrapAction(
  handler: (...args: never[]) => Promise<CommandResult>,
  exitRef: { code: number },
): (...args: never[]) => Promise<void> {
  return async (...args: never[]) => {
    const result = await handler(...args);
    if (result.message) process.stdout.write(result.message + '\n');
    if (result.diagnostics.length > 0) printDiagnostics(result.diagnostics);
    exitRef.code = result.code;
  };
}

/**
 * 创建 cac 实例并注册全部命令（不自动解析 argv）。
 * 传入 exitRef 以捕获 exit code（run 使用）。
 */
export function createApp(exitRef?: { code: number }): CAC {
  const exit = exitRef ?? { code: 0 };
  const app = cac('ark-mp');

  app
    .command('init <name>', '创建新工程')
    .option('--template <name>', '模板名（default / demo）', { default: 'default' })
    .action(wrapAction((name: string, opts: InitOptions) => initCommand(name, opts), exit));

  app.command('build', '全量构建产物').action(wrapAction(() => buildCommand(), exit));

  app.command('dev', 'watch 编译 + 唤起开发者工具').action(wrapAction(() => devCommand(), exit));

  app
    .command('compile <file>', '单文件编译（渐进接入）')
    .option('--out <dir>', '输出目录')
    .option('--runtime-path <path>', 'runtime 单文件路径')
    .action(wrapAction((file: string, opts: CompileOptions) => compileCommand(file, opts), exit));

  app
    .command('check <dir>', '只跑编译期诊断，不产出')
    .action(wrapAction((dir: string) => checkCommand(dir), exit));

  app
    .command('preview', '生成预览二维码')
    .option('--appid <id>', '小程序 appId')
    .option('--desc <text>', '版本描述')
    .option('--private-key <path>', '上传密钥文件')
    .action(wrapAction((opts: PreviewOptions) => previewCommand(opts), exit));

  app
    .command('upload', '上传代码')
    .option('--version <ver>', '版本号', { default: '' })
    .option('--appid <id>', '小程序 appId')
    .option('--desc <text>', '版本描述')
    .option('--private-key <path>', '上传密钥文件')
    .option('--robot <n>', '机器人编号', { default: 1 })
    .action(wrapAction((opts: UploadOptions) => uploadCommand(opts), exit));

  app.command('doctor', '检查环境').action(wrapAction(() => doctorCommand(), exit));

  app.help();
  app.version(getVersion());

  return app;
}

/**
 * bin 入口：解析 argv → 执行命令 → exit code。
 * 返回 exit code（不直接 process.exit，便于测试）。
 */
export async function run(argv: string[]): Promise<number> {
  const exitRef = { code: 0 };
  const app = createApp(exitRef);
  try {
    // cac 的 parse 不 await async action，我们手动 { run: false } + await runMatchedCommand
    app.parse(['node', 'ark-mp', ...argv], { run: false });
    if (app.matchedCommand) {
      await app.runMatchedCommand();
    }
  } catch (error) {
    process.stderr.write(`[arkmp] ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
  return exitRef.code;
}
