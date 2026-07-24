/**
 * 结构化诊断模型（见 docs/arkui-miniprogram/02-pipeline.md「错误诊断」）。
 *
 * 输出格式示例：
 * ```text
 * arkmp E1023 [pages/Index.ets:24:9]
 *   不支持的组件：Video（小程序端请使用 ArkMP 的 <Video> 适配组件）
 *   帮助：见 docs/arkui-miniprogram/03-component-mapping.md#视频
 * ```
 */

/** 诊断级别：error 阻断构建；warning 降级输出。 */
export type DiagnosticLevel = 'error' | 'warning';

export interface Diagnostic {
  level: DiagnosticLevel;
  /** 错误码，如 'E1023' */
  code: string;
  /** 源文件相对路径（posix 风格），可省略 */
  file?: string;
  /** 1 起始行号，可省略 */
  line?: number;
  /** 1 起始列号，可省略 */
  column?: number;
  message: string;
  /** 修复建议，可省略 */
  help?: string;
}

/** 构造 error 级诊断的便捷函数。 */
export function errorDiagnostic(
  code: string,
  message: string,
  rest: Omit<Diagnostic, 'level' | 'code' | 'message'> = {},
): Diagnostic {
  return { level: 'error', code, message, ...rest };
}

/** 构造 warning 级诊断的便捷函数。 */
export function warningDiagnostic(
  code: string,
  message: string,
  rest: Omit<Diagnostic, 'level' | 'code' | 'message'> = {},
): Diagnostic {
  return { level: 'warning', code, message, ...rest };
}

/**
 * 诊断收集器：编译各阶段向同一收集器追加诊断，结束后统一判定与输出。
 */
export class DiagnosticCollector {
  readonly diagnostics: Diagnostic[] = [];

  /** 追加单条或一个诊断数组。 */
  add(...items: Array<Diagnostic | Diagnostic[]>): void {
    for (const item of items) {
      if (Array.isArray(item)) {
        this.diagnostics.push(...item);
      } else {
        this.diagnostics.push(item);
      }
    }
  }

  /** 合并另一个收集器的全部诊断。 */
  merge(other: DiagnosticCollector): void {
    this.diagnostics.push(...other.diagnostics);
  }

  /** 是否存在 error 级诊断（存在即应阻断构建）。 */
  hasErrors(): boolean {
    return this.diagnostics.some((d) => d.level === 'error');
  }

  /** 全部 error 级诊断。 */
  errors(): Diagnostic[] {
    return this.diagnostics.filter((d) => d.level === 'error');
  }

  /** 全部 warning 级诊断。 */
  warnings(): Diagnostic[] {
    return this.diagnostics.filter((d) => d.level === 'warning');
  }

  /** 按 02 篇格式输出全部诊断，以空行分隔。 */
  format(): string {
    return this.diagnostics.map(formatDiagnostic).join('\n');
  }
}

function formatLocation(d: Diagnostic): string {
  if (d.file === undefined) return '';
  let location = d.file;
  if (d.line !== undefined) {
    location += `:${d.line}`;
    if (d.column !== undefined) {
      location += `:${d.column}`;
    }
  }
  return ` [${location}]`;
}

/**
 * 按 02 篇的统一格式输出单条诊断。
 * 无位置信息（file 缺省）时省略 `[...]` 段；column 只在 line 存在时输出。
 */
export function formatDiagnostic(d: Diagnostic): string {
  const lines = [`arkmp ${d.code}${formatLocation(d)}`];
  for (const line of d.message.split('\n')) {
    lines.push(`  ${line}`);
  }
  if (d.help !== undefined) {
    lines.push(`  帮助：${d.help}`);
  }
  return lines.join('\n');
}
