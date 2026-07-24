import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RebuildDebouncer, watch } from '../src/index';
import type { WatchEventSource, WatchEventType } from '../src/index';

/** 可编程触发的假事件源（避免真实文件事件抖动）。 */
class FakeSource implements WatchEventSource {
  private listener: ((type: WatchEventType, path: string) => void) | undefined;
  closed = false;

  onEvent(listener: (type: WatchEventType, path: string) => void): void {
    this.listener = listener;
  }

  emit(type: WatchEventType, path: string): void {
    this.listener?.(type, path);
  }

  async close(): Promise<void> {
    this.closed = true;
  }
}

describe('RebuildDebouncer（fake timers）', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('窗口内多个事件合并为一次回调（排序去重）', () => {
    const flushes: string[][] = [];
    const d = new RebuildDebouncer(50, (files) => flushes.push(files));

    d.push('b.ets');
    vi.advanceTimersByTime(20);
    d.push('a.ets');
    d.push('b.ets'); // 重复
    vi.advanceTimersByTime(50);

    expect(flushes).toEqual([['a.ets', 'b.ets']]);
  });

  it('每个窗口内的新事件重置定时器（持续变更只回调一次）', () => {
    const flushes: string[][] = [];
    const d = new RebuildDebouncer(50, (files) => flushes.push(files));

    d.push('a.ets');
    vi.advanceTimersByTime(40);
    d.push('b.ets'); // 重置
    vi.advanceTimersByTime(40);
    expect(flushes).toEqual([]); // 距上次事件仅 40ms，未到窗口
    vi.advanceTimersByTime(10);
    expect(flushes).toEqual([['a.ets', 'b.ets']]);
  });

  it('相隔超过窗口的两批事件回调两次', () => {
    const flushes: string[][] = [];
    const d = new RebuildDebouncer(50, (files) => flushes.push(files));

    d.push('a.ets');
    vi.advanceTimersByTime(50);
    d.push('b.ets');
    vi.advanceTimersByTime(50);

    expect(flushes).toEqual([['a.ets'], ['b.ets']]);
  });

  it('cancel 丢弃待回调事件；flush 立即冲刷', () => {
    const flushes: string[][] = [];
    const d = new RebuildDebouncer(50, (files) => flushes.push(files));

    d.push('a.ets');
    d.flush();
    expect(flushes).toEqual([['a.ets']]);

    d.push('b.ets');
    d.cancel();
    vi.advanceTimersByTime(100);
    expect(flushes).toEqual([['a.ets']]);
  });
});

describe('watch（注入事件源）', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('add/change/unlink 事件经去抖合并后触发 onRebuild', async () => {
    const source = new FakeSource();
    const batches: string[][] = [];
    const session = watch('/project/src', {
      debounceMs: 50,
      source,
      onRebuild: (files) => batches.push(files),
    });

    source.emit('change', 'pages/index/Index.ets');
    source.emit('add', 'components/UserCard.ets');
    vi.advanceTimersByTime(50);
    expect(batches).toEqual([['components/UserCard.ets', 'pages/index/Index.ets']]);

    source.emit('unlink', 'components/UserCard.ets');
    vi.advanceTimersByTime(50);
    expect(batches).toHaveLength(2);

    await session.close();
    expect(source.closed).toBe(true);
    // close 后不再回调
    source.emit('change', 'x.ets');
    vi.advanceTimersByTime(100);
    expect(batches).toHaveLength(2);
  });
});

describe('watch（真实 chokidar + 临时目录）', () => {
  it('文件变更触发一次合并回调，路径为相对 posix', async () => {
    const root = mkdtempSync(join(tmpdir(), 'arkmp-watcher-'));
    try {
      const batches: string[][] = [];
      const session = watch(root, {
        debounceMs: 20,
        onRebuild: (files) => batches.push(files),
      });

      // 等 watcher ready 后再写文件
      await new Promise((resolve) => setTimeout(resolve, 100));
      writeFileSync(join(root, 'a.txt'), '1');
      writeFileSync(join(root, 'b.txt'), '2');

      await vi.waitFor(
        () => {
          expect(batches.length).toBeGreaterThan(0);
        },
        { timeout: 3000, interval: 50 },
      );
      await session.close();

      const all = batches.flat().sort();
      expect(all).toEqual(['a.txt', 'b.txt']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 10000);
});
