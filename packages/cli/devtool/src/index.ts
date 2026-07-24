/**
 * @arkmp/devtool —— L7 微信开发者工具封装（07 篇「预览/上传」「唤起开发者工具」）。
 *
 * - `openDevtool(projectPath, { devtoolPath? })`：定位开发者工具的命令行
 *   （macOS：`<app 路径>/Contents/MacOS/cli`），存在性检查后 spawn
 *   `cli open --project <projectPath>`（detached，不阻塞 CLI 进程）；
 * - `preview(options)` / `upload(options)`：封装 miniprogram-ci。该依赖按需
 *   可选加载——未安装时不崩溃，返回带安装指引的 error 诊断。
 *
 * spawn 与 miniprogram-ci 模块均可经 deps 参数注入（测试用），缺省走真实实现。
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { errorDiagnostic } from '@arkmp/diagnostics';
import type { Diagnostic } from '@arkmp/diagnostics';

/** devtool 包诊断码。 */
export const DEVTOOL_DIAGNOSTIC_CODES = {
  /** 开发者工具 CLI 不存在 */
  DEVTOOL_NOT_FOUND: 'E7101',
  /** miniprogram-ci 未安装 */
  MINIPROGRAM_CI_MISSING: 'E7102',
  /** miniprogram-ci 调用失败 */
  CI_FAILED: 'E7103',
} as const;

/** macOS 微信开发者工具默认安装路径。 */
export const DEFAULT_DEVTOOL_PATH = '/Applications/wechatwebdevtools.app';

/** 命令执行结果（诊断为空数组表示成功）。 */
export interface ActionResult {
  ok: boolean;
  diagnostics: Diagnostic[];
}

const ok: ActionResult = { ok: true, diagnostics: [] };
const fail = (...diagnostics: Diagnostic[]): ActionResult => ({ ok: false, diagnostics });

// ── 开发者工具唤起 ──

/** 由 app 安装路径推导 CLI 路径（macOS 包内结构）。 */
export function devtoolCliPath(devtoolPath: string = DEFAULT_DEVTOOL_PATH): string {
  return join(devtoolPath, 'Contents/MacOS/cli');
}

export interface ResolveDevtoolDeps {
  /** 存在性检查（测试注入），缺省 existsSync */
  exists?: (path: string) => boolean;
}

/**
 * 定位开发者工具 CLI：存在返回其路径，不存在返回 error 诊断
 * （help 提示安装或配置 devServer.devtoolPath）。
 */
export function resolveDevtoolCli(
  devtoolPath?: string,
  deps: ResolveDevtoolDeps = {},
): { cli?: string; diagnostic?: Diagnostic } {
  const cli = devtoolCliPath(devtoolPath);
  const exists = deps.exists ?? existsSync;
  if (!exists(cli)) {
    return {
      diagnostic: errorDiagnostic(
        DEVTOOL_DIAGNOSTIC_CODES.DEVTOOL_NOT_FOUND,
        `未找到微信开发者工具命令行：${cli}`,
        { help: '安装微信开发者工具，或在 arkmp.config.ts 的 devServer.devtoolPath 配置安装路径' },
      ),
    };
  }
  return { cli };
}

/** spawn 形态（测试注入），与 node:child_process.spawn 对齐。 */
export type SpawnFn = (
  command: string,
  args: readonly string[],
  options: { detached: boolean; stdio: 'ignore' },
) => { unref(): void };

export interface OpenDevtoolOptions {
  /** 开发者工具安装路径，缺省 DEFAULT_DEVTOOL_PATH */
  devtoolPath?: string;
}

export interface OpenDevtoolDeps extends ResolveDevtoolDeps {
  spawn?: SpawnFn;
}

const defaultSpawn: SpawnFn = (command, args, options) => spawn(command, args, options);

/** 唤起微信开发者工具并打开产物目录（dist/）。CLI 不存在时返回诊断，不抛异常。 */
export function openDevtool(
  projectPath: string,
  options: OpenDevtoolOptions = {},
  deps: OpenDevtoolDeps = {},
): ActionResult {
  const { cli, diagnostic } = resolveDevtoolCli(options.devtoolPath, deps);
  if (cli === undefined) return fail(diagnostic as Diagnostic);
  const child = (deps.spawn ?? defaultSpawn)(cli, ['open', '--project', projectPath], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
  return ok;
}

// ── miniprogram-ci 封装 ──

/** miniprogram-ci 的结构化类型（只声明用到的面）。 */
export interface MiniprogramCi {
  Project: new (options: Record<string, unknown>) => unknown;
  preview(options: Record<string, unknown>): Promise<unknown>;
  upload(options: Record<string, unknown>): Promise<unknown>;
}

export interface CiBaseOptions {
  /** 小程序产物目录（dist/） */
  projectPath: string;
  /** 小程序 appId */
  appId: string;
  /** 代码上传密钥文件路径（微信公众平台下载的 private.<appId>.key） */
  privateKeyPath?: string;
}

export interface PreviewOptions extends CiBaseOptions {
  /** 预览版本描述（缺省由 CLI 生成） */
  desc?: string;
  /** 二维码输出：'terminal' 直接在终端打印；否则为图片输出路径 */
  qrcodeOutput?: string;
}

export interface UploadOptions extends CiBaseOptions {
  /** 版本号（必填） */
  version: string;
  /** 版本描述 */
  desc?: string;
  /** 机器人编号（1–30），缺省 1 */
  robot?: number;
}

export interface CiDeps {
  /** 注入 miniprogram-ci 模块（测试用）；缺省按需 require，未安装给友好诊断 */
  ci?: MiniprogramCi;
}

/** 可选加载 miniprogram-ci：未安装时返回带安装指引的 error 诊断（不崩溃）。 */
function loadMiniprogramCi(deps: CiDeps): { ci?: MiniprogramCi; diagnostic?: Diagnostic } {
  if (deps.ci !== undefined) return { ci: deps.ci };
  try {
    const require = createRequire(import.meta.url);
    return { ci: require('miniprogram-ci') as MiniprogramCi };
  } catch {
    return {
      diagnostic: errorDiagnostic(
        DEVTOOL_DIAGNOSTIC_CODES.MINIPROGRAM_CI_MISSING,
        '未安装 miniprogram-ci，无法执行 preview/upload',
        { help: '在工程中安装：npm i -D miniprogram-ci（并确认已配置代码上传密钥）' },
      ),
    };
  }
}

function createProject(ci: MiniprogramCi, options: CiBaseOptions): unknown {
  return new ci.Project({
    appid: options.appId,
    type: 'miniProgram',
    projectPath: options.projectPath,
    ...(options.privateKeyPath !== undefined ? { privateKeyPath: options.privateKeyPath } : {}),
    ignores: ['node_modules/**/*'],
  });
}

function ciFailure(action: string, error: unknown): ActionResult {
  return fail(
    errorDiagnostic(
      DEVTOOL_DIAGNOSTIC_CODES.CI_FAILED,
      `miniprogram-ci ${action} 失败：${error instanceof Error ? error.message : String(error)}`,
    ),
  );
}

/** 生成预览二维码（封装 miniprogram-ci preview）。 */
export async function preview(options: PreviewOptions, deps: CiDeps = {}): Promise<ActionResult> {
  const { ci, diagnostic } = loadMiniprogramCi(deps);
  if (ci === undefined) return fail(diagnostic as Diagnostic);
  try {
    await ci.preview({
      project: createProject(ci, options),
      desc: options.desc ?? 'ark-mp preview',
      qrcodeFormat: options.qrcodeOutput === undefined ? 'terminal' : 'image',
      ...(options.qrcodeOutput !== undefined ? { qrcodeOutputDest: options.qrcodeOutput } : {}),
    });
    return ok;
  } catch (error) {
    return ciFailure('preview', error);
  }
}

/** 上传代码（封装 miniprogram-ci upload）。 */
export async function upload(options: UploadOptions, deps: CiDeps = {}): Promise<ActionResult> {
  const { ci, diagnostic } = loadMiniprogramCi(deps);
  if (ci === undefined) return fail(diagnostic as Diagnostic);
  try {
    await ci.upload({
      project: createProject(ci, options),
      version: options.version,
      desc: options.desc ?? '',
      robot: options.robot ?? 1,
      setting: { es6: true, minify: true },
    });
    return ok;
  } catch (error) {
    return ciFailure('upload', error);
  }
}
