# @arkmp/diagnostics

编译器统一的结构化诊断模型、收集器与格式化输出。

## 所属层

L0 基础层（core），无业务语义，不依赖其他 workspace 包。

## 依赖

无外部依赖。

## 导出 API

### `DiagnosticLevel`

```ts
type DiagnosticLevel = 'error' | 'warning';
```

诊断级别：`error` 阻断构建；`warning` 降级输出。

### `Diagnostic`

```ts
interface Diagnostic {
  level: DiagnosticLevel;
  code: string;       // 错误码，如 'E1023'
  file?: string;      // 源文件相对路径（posix 风格），可省略
  line?: number;      // 1 起始行号，可省略
  column?: number;    // 1 起始列号，可省略
  message: string;
  help?: string;      // 修复建议，可省略
}
```

单条诊断的结构。

### `errorDiagnostic(code: string, message: string, rest?: Omit<Diagnostic, ...>): Diagnostic`

构造 `error` 级诊断的便捷函数。`rest` 可补充位置、`help` 等字段。

### `warningDiagnostic(code: string, message: string, rest?: Omit<Diagnostic, ...>): Diagnostic`

构造 `warning` 级诊断的便捷函数。`rest` 可补充位置、`help` 等字段。

### `DiagnosticCollector`

诊断收集器。编译各阶段向同一收集器追加诊断，结束后统一判定与输出。

- `diagnostics: Diagnostic[]`（readonly）—— 已收集的全部诊断。
- `add(...items: Array<Diagnostic | Diagnostic[]>): void` —— 追加单条或一个诊断数组。
- `merge(other: DiagnosticCollector): void` —— 合并另一个收集器的全部诊断。
- `hasErrors(): boolean` —— 是否存在 `error` 级诊断（存在即应阻断构建）。
- `errors(): Diagnostic[]` —— 全部 `error` 级诊断。
- `warnings(): Diagnostic[]` —— 全部 `warning` 级诊断。
- `format(): string` —— 按统一格式输出全部诊断，以空行分隔。

### `formatDiagnostic(d: Diagnostic): string`

按统一格式输出单条诊断。无位置信息（`file` 缺省）时省略 `[...]` 段；`column` 只在 `line` 存在时输出。输出示例：

```text
arkmp E1023 [pages/Index.ets:24:9]
  不支持的组件：Video
  帮助：见 03-component-mapping.md
```

## 用法示例

```ts
import {
  DiagnosticCollector,
  errorDiagnostic,
  warningDiagnostic,
} from '@arkmp/diagnostics';

const collector = new DiagnosticCollector();

collector.add(
  errorDiagnostic('E1023', '不支持的组件：Video', {
    file: 'pages/Index.ets',
    line: 24,
    column: 9,
    help: '见 03-component-mapping.md#视频',
  }),
  warningDiagnostic('W2001', '未使用的 @State 字段'),
);

if (collector.hasErrors()) {
  console.error(collector.format());
  process.exit(1);
}
```

## 测试

```bash
pnpm --filter @arkmp/diagnostics test
```
