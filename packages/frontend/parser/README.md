# @arkmp/parser

将 `.ets`（ArkUI 声明式语法）源码预处理为合法 TypeScript，并解析为 TS AST；维护生成代码到原始源码的行列位置映射，供上层诊断回溯。

## 所属层

L1 frontend（源码 → IR）

## 依赖

- `@arkmp/diagnostics`（`workspace:*`）：语法错误格式化为结构化 Diagnostic。
- `typescript`（`^5.9.3`）：使用 TypeScript 编译器 API 解析源码为 AST。

## 导出 API

### `parse(source: string, fileName?: string): ParseResult`

解析 `.ets` 源码为 TS AST。内部依次执行：链式调用续行预处理 → `struct`→`class` 预处理 → 位置映射组合 → `ts.createSourceFile` 解析。语法错误不抛异常，收集为 error 级 Diagnostic（行列已通过位置映射回溯到原始源码）。`fileName` 默认 `'index.ets'`。

### `ParseResult`

`parse` 的返回值：

- `sourceFile: ts.SourceFile` — TS AST（`struct` 已预处理为 `class`）。
- `positionMap: PositionMap` — 生成代码 → 原始源码的位置映射。
- `diagnostics: Diagnostic[]` — 语法错误诊断。

### `preprocessStruct(source: string): PreprocessResult`

将源码中的 `struct X` 声明替换为 `class X`，使 TS 解析器可直接消费（`struct` 比 `class` 长 1 字符，产生 +1 列偏移并计入位置映射）。

### `preprocessChainContinuations(source: string): PreprocessResult`

在尾随子节点块之后的行首链式调用（`.width(...)`）前插入标记标识符 `__arkmp_chain`，使其成为合法 TS 表达式语句。判定规则：一行以 `.标识符` 开头，且上一行以 `}` 结尾或上一行本身已被标记。

### `composePositionMaps(...maps: PositionMap[]): PositionMap`

组合多趟预处理的位置映射（要求各趟均不换行，条目求和语义下可直接合并）。

### `PositionMap`

生成代码 → 原始源码的位置映射：

- `entries: PositionMapEntry[]` — 全部偏移记录，按行列升序。
- `toOriginal(line, column)` — 将生成代码的 1 起始行列回溯为原始源码的 1 起始行列。

### `PositionMapEntry`

单条列偏移记录：

- `line: number` — 1 起始行号。
- `fromColumn: number` — 1 起始列号：生成代码中从该列起本条偏移生效。
- `delta: number` — 对「原始列 = 生成列 + delta」的贡献（`struct`→`class` 为 +1，标记插入为 -标记长度）。

### `PreprocessResult`

`preprocessStruct` / `preprocessChainContinuations` 的返回值：

- `code: string` — 预处理后的代码。
- `positionMap: PositionMap` — 位置映射。

### `CHAIN_MARKER`（常量）

行首链式调用插入的标记标识符 `'__arkmp_chain'`，analyzer 据此识别续链语句。

### `PARSER_ERROR_CODES`（常量）

parser 阶段诊断码（E1xxx）：

- `SYNTAX_ERROR: 'E1006'` — TS 语法解析错误。

## 用法示例

```ts
import { parse } from '@arkmp/parser';

const source = `
@Entry
@Component
struct MyPage {
  @State count: number = 0

  build() {
    Column({ space: 12 }) {
      Text('点击次数：' + this.count)
    }
    .width('100%')
  }
}
`;

const { sourceFile, positionMap, diagnostics } = parse(source, 'MyPage.ets');

if (diagnostics.length > 0) {
  for (const d of diagnostics) {
    console.log(`${d.location?.line}:${d.location?.column} ${d.code} ${d.message}`);
  }
} else {
  // sourceFile 可传给 @arkmp/analyzer 的 analyze()
  console.log(sourceFile.fileName);
}
```

## 测试

```bash
pnpm --filter @arkmp/parser test
```
