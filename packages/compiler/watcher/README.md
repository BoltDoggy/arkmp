# @arkmp/watcher

文件监听封装：基于 chokidar 将 `add`/`change`/`unlink` 事件去抖合并后回调一次 `onRebuild(files)`，为 watch 模式提供事件源。

## 所属层

L4 compiler（编译内核）

## 依赖

| 依赖 | 原因 |
| --- | --- |
| `@arkmp/shared` | `normalizePath` 将绝对路径转为相对 posix 路径 |
| `chokidar` | 文件系统事件监听（`add`/`change`/`unlink`） |

## 导出 API

### `watch(root: string, options: WatchOptions): WatchSession`

监听 `root` 下的文件变更：事件 → 去抖合并 → `onRebuild(files)`。返回 session，`close()` 停止监听。

### `WatchEventType`

```ts
type WatchEventType = 'add' | 'change' | 'unlink';
```

文件事件类型（与 chokidar 对齐）。

### `interface WatchEventSource`

文件事件源抽象，默认实现为 chokidar，测试可注入假实现。

- `onEvent(listener: (type: WatchEventType, path: string) => void): void` — 注册回调，`path` 为相对 root 的 posix 路径。
- `close(): Promise<void>` — 停止监听并释放资源。

### `class RebuildDebouncer`

去抖合并器：debounceMs 窗口内的事件合并为一次回调。纯定时器逻辑，不碰文件系统，测试用 fake timers 驱动。

- `constructor(debounceMs: number, onFlush: (files: string[]) => void)`
- `push(path: string): void` — 记录一个变更文件，窗口内重复 push 会重置定时器。
- `flush(): void` — 有待回调事件时立即冲刷（close 前调用，避免丢事件）。
- `cancel(): void` — 丢弃待回调事件并停表。

### `interface WatchOptions`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `debounceMs?` | `number` | 去抖窗口（毫秒），默认 50 |
| `ignore?` | `string \| RegExp \| readonly (string \| RegExp)[]` | chokidar 的 ignored 选项，注入 source 时无效 |
| `onRebuild` | `(files: string[]) => void` | 变更批次回调（去抖合并后触发一次） |
| `source?` | `WatchEventSource` | 注入事件源（测试用），缺省用 chokidar 监听 root |

### `interface WatchSession`

- `close(): Promise<void>` — 停止监听（丢弃未冲刷的待回调事件）。

## 用法示例

```ts
import { watch } from '@arkmp/watcher';

const session = watch('/path/to/project/src', {
  debounceMs: 50,
  ignore: /node_modules/,
  onRebuild: (files) => {
    console.log('变更文件:', files);
    // 在此触发增量编译
  },
});

// 需要停止时
await session.close();
```

## 测试

```bash
pnpm --filter @arkmp/watcher test
```
