# @arkmp/shared

编译器各阶段共用的纯函数工具：内容哈希、路径规范化、统一日志接口。

## 所属层

L0 基础层（core），无业务语义，不依赖其他 workspace 包。

## 依赖

无外部依赖。

## 导出 API

### `hashContent(content: string): string`

计算内容的 sha1 哈希（hex），用于增量编译的变更判定。

### `normalizePath(p: string): string`

将路径统一为 posix 分隔符（`\` → `/`），并去掉开头的 `./`。用于诊断、产物路径等需要跨平台一致输出的场景。

### `LogLevel`

```ts
type LogLevel = 'debug' | 'info' | 'warn' | 'error';
```

日志级别，低级日志在高级别下不输出。

### `Logger`

```ts
interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}
```

统一日志接口，编译器各阶段通过 `Logger` 输出，便于测试时替换。

### `createConsoleLogger(minLevel?: LogLevel, sink?: Pick<Console, ...>): Logger`

创建输出到 console 的 `Logger`。

- `minLevel`：最低输出级别，默认 `'info'`。
- `sink`：输出目标（默认 `console`），测试时可注入收集器。

## 用法示例

```ts
import { createConsoleLogger, hashContent, normalizePath } from '@arkmp/shared';

const logger = createConsoleLogger('warn');
logger.info('这条不会输出'); // 低于 warn
logger.error('文件解析失败：%s', normalizePath('.\\src\\Index.ets'));

const digest = hashContent('一些源码内容');
// → sha1 hex 字符串，用于增量编译判定内容是否变化
```

## 测试

```bash
pnpm --filter @arkmp/shared test
```
