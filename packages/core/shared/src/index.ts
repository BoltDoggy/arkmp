import { createHash } from 'node:crypto';

/**
 * 计算内容的 sha1 哈希（hex），用于增量编译的变更判定。
 */
export function hashContent(content: string): string {
  return createHash('sha1').update(content).digest('hex');
}

/**
 * 将路径统一为 posix 分隔符（`\` → `/`），并去掉开头的 `./`。
 * 用于诊断、产物路径等需要跨平台一致输出的场景。
 */
export function normalizePath(p: string): string {
  const normalized = p.replace(/\\/g, '/');
  return normalized.startsWith('./') ? normalized.slice(2) : normalized;
}

/** 日志级别，低级日志在高级别下不输出。 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/** 统一日志接口，编译器各阶段通过 Logger 输出，便于测试时替换。 */
export interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

/**
 * 创建输出到 console 的 Logger。
 * @param minLevel 最低输出级别，默认 'info'
 * @param sink 输出目标（默认 console），测试时可注入收集器
 */
export function createConsoleLogger(
  minLevel: LogLevel = 'info',
  sink: Pick<Console, 'debug' | 'info' | 'warn' | 'error'> = console,
): Logger {
  const emit = (level: LogLevel, message: string, args: unknown[]): void => {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel]) return;
    sink[level](`[arkmp] ${message}`, ...args);
  };
  return {
    debug: (message, ...args) => emit('debug', message, args),
    info: (message, ...args) => emit('info', message, args),
    warn: (message, ...args) => emit('warn', message, args),
    error: (message, ...args) => emit('error', message, args),
  };
}
