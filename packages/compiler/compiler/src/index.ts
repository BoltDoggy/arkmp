/**
 * @arkmp/compiler —— L4 工程级编译入口（**对外发布包**）。
 *
 * 组合 L4 各内核包完成「ArkUI 源码工程 → 标准微信小程序工程」：
 *
 * ```text
 * 扫描 src/（app.ets / pages / components / resources/media）
 *   → @arkmp/pipeline 单文件编译（四件套）
 *   → usingComponents 解析（@arkmp/mapping-components + 命名约定）
 *   → runtime 注入（@arkmp/runtime 单文件 → dist/arkmp/runtime.js，
 *     产物 js 的 require('@arkmp/runtime') 改写为相对路径）
 *   → app.json 合成（pages 列表 + window/tabBar/permission）
 *   → 增量：@arkmp/incremental + @arkmp/dep-graph 级联重建
 *   → watch：@arkmp/watcher 事件 → 增量调度
 * ```
 *
 * 三个入口：
 * - `compileProject(options)`：一次性编译（不清空产物目录，便于渐进接入）；
 * - `buildProject(options)`：产物构建（清空产物目录后全量编译，对齐 `ark-mp build`）；
 * - `createWatchSession(options)`：watch 会话（`build()` 增量构建、`start()` 开始监听）。
 *
 * 配置是普通对象（字段对齐 07 篇 arkmp.config.ts）；arkmp.config.ts 的加载
 * 是 P7 @arkmp/config 的职责，不在本包。
 */

import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { watch } from '@arkmp/watcher';
import type { WatchEventSource, WatchSession as WatcherHandle } from '@arkmp/watcher';
import { CompilerSession } from './session';
import type { BuildResult, CompileProjectOptions } from './session';

export { CompilerSession } from './session';
export type { BuildResult, CompileProjectOptions } from './session';
export type { TabBarOptions } from './app-files';
export { COMPILER_DIAGNOSTIC_CODES } from './app-files';

/** 一次性编译工程：扫描 src/ 全量编译，写入 dist/（不清空产物目录）。 */
export async function compileProject(options: CompileProjectOptions): Promise<BuildResult> {
  return new CompilerSession(options).build();
}

/** 产物构建：清空产物目录后全量编译（`ark-mp build` 语义）。 */
export async function buildProject(options: CompileProjectOptions): Promise<BuildResult> {
  rmSync(join(options.rootDir, options.outDir ?? 'dist'), { recursive: true, force: true });
  return new CompilerSession(options).build();
}

/** watch 模式的附加配置。 */
export interface WatchSessionOptions extends CompileProjectOptions {
  watch?: {
    /** 去抖窗口（毫秒），默认 50 */
    debounceMs?: number;
    /** chokidar 的 ignored 选项 */
    ignore?: string | RegExp | readonly (string | RegExp)[];
    /** 注入事件源（测试用），缺省为 chokidar */
    source?: WatchEventSource;
  };
}

/** watch 会话句柄。 */
export interface CompilerWatchSession {
  /** 手动触发构建：无参全量；传入 changedFiles（src 相对 posix 路径）为增量。 */
  build(changedFiles?: string[]): Promise<BuildResult>;
  /** 首次全量构建 + 开始监听；每次增量构建完成回调 onBuilt。 */
  start(onBuilt?: (result: BuildResult) => void): Promise<BuildResult>;
  /** 停止监听。 */
  close(): Promise<void>;
}

/**
 * 创建 watch 会话：watcher（add/change/unlink → 去抖合并）→ 增量 build。
 * 增量构建串行执行（构建期间到达的变更批次排队，不并发写产物目录）。
 */
export function createWatchSession(options: WatchSessionOptions): CompilerWatchSession {
  const session = new CompilerSession(options);
  let watcher: WatcherHandle | undefined;
  let queue: Promise<unknown> = Promise.resolve();

  const enqueue = (files: string[], onBuilt?: (result: BuildResult) => void): void => {
    queue = queue
      .then(() => session.build(files))
      .then((result) => onBuilt?.(result))
      .catch((error: unknown) => {
        options.logger?.error('增量构建失败', error);
      });
  };

  return {
    build: (changedFiles?: string[]) => session.build(changedFiles),
    start: async (onBuilt?: (result: BuildResult) => void) => {
      const first = await session.build();
      watcher = watch(join(options.rootDir, options.srcDir ?? 'src'), {
        debounceMs: options.watch?.debounceMs ?? 50,
        ...(options.watch?.ignore !== undefined ? { ignore: options.watch.ignore } : {}),
        ...(options.watch?.source !== undefined ? { source: options.watch.source } : {}),
        onRebuild: (files) => enqueue(files, onBuilt),
      });
      return first;
    },
    close: async () => {
      await watcher?.close();
      watcher = undefined;
    },
  };
}
