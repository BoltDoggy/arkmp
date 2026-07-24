# @arkmp/analyzer

将 parser 产出的 TS AST 进行语义分析，提取组件元数据（states / props / lifecycle / methods）、构建 UI 节点树、分类表达式，输出核心 IR `ComponentModel`。

## 所属层

L1 frontend（源码 → IR）

## 依赖

- `@arkmp/diagnostics`（`workspace:*`）：语义错误格式化为结构化 Diagnostic。
- `@arkmp/ir`（`workspace:*`）：提供 `ComponentModel`、`UINode`、`Expression` 等 IR 类型，以及 `assignNodeIds` 为节点分配稳定 id。
- `typescript`（`^5.9.3`）：遍历 TS AST 提取语义信息。
- `@arkmp/parser`（`devDependencies`，`workspace:*`）：仅测试中使用，提供 `parse` 产物作为 analyze 输入。

## 导出 API

### `analyze(sourceFile: ts.SourceFile, fileName?: string): AnalyzeResult`

语义分析主入口。将 TS AST 转换为 `ComponentModel`（核心 IR），流程包括：

- 装饰器白名单校验，未知装饰器报 `E1101`；
- 提取 `@State` → states、`@Prop`/`@Link`/无装饰器 → props、生命周期方法（`aboutToAppear` 等）→ lifecycle、普通方法体序列化为源码文本 → methods；
- `build()` 与 `@Builder` 方法 → UINode 树（`if` 归一为 IfNode、`ForEach` 归一为 ForEachNode）；
- 结尾调用 `assignNodeIds` 分配稳定节点 id。

`fileName` 默认取 `sourceFile.fileName`。

### `AnalyzeResult`

`analyze` 的返回值：

- `model: ComponentModel` — 核心 IR，包含组件名、states、props、lifecycle、methods、buildTree、builders 等。
- `diagnostics: Diagnostic[]` — 语义错误诊断。

### `ANALYZER_ERROR_CODES`（常量）

analyzer 阶段诊断码（E1xxx）：

- `UNKNOWN_DECORATOR: 'E1101'` — 未知装饰器（不在白名单内）。
- `UNSUPPORTED_UI_SYNTAX: 'E1102'` — `build()`/`@Builder` 中无法识别的 UI 语法。
- `INVALID_BUILD_ROOT: 'E1103'` — `build()`/`@Builder` 缺少唯一组件根节点。
- `MISSING_COMPONENT: 'E1104'` — 文件中没有组件声明（`class`/`struct`）。
- `MISSING_BUILD: 'E1105'` — 组件缺少 `build()` 方法。

### `DECORATOR_WHITELIST`（常量）

装饰器白名单（08 篇「支持的语言特性」），包含 9 个装饰器：

- 组件级：`@Entry` / `@Component`
- 字段级：`@State` / `@Prop` / `@Link` / `@Watch`
- 方法级：`@Builder` / `@Styles` / `@Extend`

### `classifyExpression(expr: ts.Expression, sourceFile: ts.SourceFile): Expression`

将 TS 表达式序列化为 IR `Expression`（来自 `@arkmp/ir`），分类规则：

- **纯静态**（字面量、常量运算、大写开头的常量引用如 `FlexAlign.Center`）→ `{ kind: 'static', value }`，编译期已求值。
- **状态绑定**（含 `this.xxx`、迭代变量 `item.name`）→ `{ kind: 'binding', path, template }`，`path` 为第一条绑定路径（去掉 `this.`），`template` 中 `${i}` 为第 i 个绑定路径的占位。
- 既不可静态求值也无状态引用（如 `new Date()`）→ 保留源码文本为 `{ kind: 'static', value }`。

## 用法示例

```ts
import { parse } from '@arkmp/parser';
import { analyze } from '@arkmp/analyzer';

const { sourceFile, diagnostics: parseDiag } = parse(source, 'MyPage.ets');
if (parseDiag.length > 0) {
  // 处理语法错误
}

const { model, diagnostics: analyzeDiag } = analyze(sourceFile);

console.log(model.name);          // 'MyPage'
console.log(model.isEntry);       // true（有 @Entry）
console.log(model.states);        // [{ name: 'count', type: 'number', ... }]
console.log(model.buildTree);     // UINode（已分配节点 id）
```

## 测试

```bash
pnpm --filter @arkmp/analyzer test
```
