/**
 * @arkmp/watcher —— L4 文件监听（docs/arkui-miniprogram/02-pipeline.md ⑥ watch 模式）。
 *
 * chokidar 封装：`add` / `change` / `unlink` 事件 → 去抖合并（默认 50ms）→
 * 回调一次 `onRebuild(files)`（files 为相对 root 的 posix 路径，排序去重）。
 *
 * 结构上分两层，便于测试：
 * - `RebuildDebouncer`：纯定时器逻辑（事件合并 + 去抖），可配合 fake timers 单测；
 * - `watch(root, options)`：chokidar 事件源 + debouncer 的接线；事件源可通过
 *   `options.source` 注入（测试避免真实文件事件抖动）。
 */

import { watch as chokidarWatch } from 'chokidar';
import type { FSWatcher } from 'chokidar';
import { relative } from 'node:path';
import { normalizePath } from '@arkmp/shared';

/** 文件事件类型（与 chokidar 对齐）。 */
export type WatchEventType = 'add' | 'change' | 'unlink';

/**
 * 文件事件源抽象：默认实现为 chokidar，测试可注入假实现。
 */
export interface WatchEventSource {
  /** 注册事件回调；path 为相对被监听 root 的 posix 路径。 */
  onEvent(listener: (type: WatchEventType, path: string) => void): void;
  /** 停止监听并释放资源。 */
  close(): Promise<void>;
}

/**
 * 去抖合并器：debounceMs 窗口内的事件合并为一次回调。
 * 纯定时器逻辑（不碰文件系统），测试用 fake timers 驱动。
 */
export class RebuildDebouncer {
  private readonly pending = new Set<string>();
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly debounceMs: number,
    private readonly onFlush: (files: string[]) => void,
  ) {}

  /** 记录一个变更文件；窗口内重复 push 会重置定时器。 */
  push(path: string): void {
    this.pending.add(path);
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = undefined;
      const files = [...this.pending].sort();
      this.pending.clear();
      if (files.length > 0) this.onFlush(files);
    }, this.debounceMs);
  }

  /** 有待回调事件时立即冲刷（close 前调用，避免丢事件）。 */
  flush(): void {
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    const files = [...this.pending].sort();
    this.pending.clear();
    if (files.length > 0) this.onFlush(files);
  }

  /** 丢弃待回调事件并停表。 */
  cancel(): void {
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    this.pending.clear();
  }
}

export interface WatchOptions {
  /** 去抖窗口（毫秒），默认 50 */
  debounceMs?: number;
  /** chokidar 的 ignored 选项（如 `/node_modules/`），注入 source 时无效 */
  ignore?: string | RegExp | readonly (string | RegExp)[];
  /** 变更批次回调（去抖合并后触发一次） */
  onRebuild: (files: string[]) => void;
  /** 注入事件源（测试用）；缺省用 chokidar 监听 root */
  source?: WatchEventSource;
}

export interface WatchSession {
  /** 停止监听（丢弃未冲刷的待回调事件）。 */
  close(): Promise<void>;
}

/** chokidar 事件源：监听 root，忽略初始扫描事件，路径转为相对 posix。 */
function createChokidarSource(root: string, ignore: WatchOptions['ignore']): WatchEventSource {
  const watcher: FSWatcher = chokidarWatch(root, {
    ignoreInitial: true,
    ...(ignore !== undefined ? { ignored: ignore as never } : {}),
  });
  return {
    onEvent(listener) {
      const emit = (type: WatchEventType) => (absolutePath: string) =>
        listener(type, normalizePath(relative(root, absolutePath)));
      watcher.on('add', emit('add'));
      watcher.on('change', emit('change'));
      watcher.on('unlink', emit('unlink'));
    },
    close: () => watcher.close(),
  };
}

/**
 * 监听 root 下的文件变更：add/change/unlink → 去抖合并 → onRebuild(files)。
 * 返回 session，`close()` 停止监听（未冲刷的待回调事件被丢弃）。
 */
export function watch(root: string, options: WatchOptions): WatchSession {
  const source = options.source ?? createChokidarSource(root, options.ignore);
  const debouncer = new RebuildDebouncer(options.debounceMs ?? 50, options.onRebuild);
  let closed = false;
  source.onEvent((_type, path) => {
    if (closed) return;
    debouncer.push(path);
  });
  return {
    close: async () => {
      closed = true;
      debouncer.cancel();
      await source.close();
    },
  };
}
