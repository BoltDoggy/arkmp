# @arkmp/ir

ArkMP 编译器的中间表示（IR）：目标无关的组件模型类型、节点 id 分配、序列化与结构校验。IR 不引用 `ts.Node`，所有表达式在 analyze 阶段已序列化为静态/绑定描述。

## 所属层

L0 基础层（core），无业务语义。

## 依赖

- `@arkmp/diagnostics`（`workspace:*`）：`validateIR` 的校验结果以 `Diagnostic[]` 形式返回。

## 导出 API

### 类型（types.ts）

#### `Expression = StaticExpression | BindingExpression`

表达式描述。

#### `StaticExpression`

```ts
interface StaticExpression {
  kind: 'static';
  value: unknown; // 编译期已求值的字面量
}
```

纯静态表达式，编译期可求值，如 `.fontSize(20)` 的 `20`。

#### `BindingExpression`

```ts
interface BindingExpression {
  kind: 'binding';
  path: string;       // 状态路径，如 'count'、'form.id'
  template?: string;  // 模板字符串，${0} 占位 path 求值结果
}
```

依赖状态的表达式，进 WXML `{{}}` 绑定。

#### `StyleCall`

```ts
interface StyleCall {
  name: string;      // 如 'fontSize'
  args: Expression[];
}
```

链式样式调用，如 `.fontSize(20)` → `{ name: 'fontSize', args: [static 20] }`。

#### `EventCall`

```ts
interface EventCall {
  name: string; // 如 'onClick'
  body: string; // 回调体源码文本（已序列化）
}
```

链式事件调用。事件名由所在节点 id 派生（如 `__n7_click`）。

#### `UINode`

普通 UI 节点（组件调用 + 链式调用 + 子节点）。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `type` | `'component'` | |
| `id?` | `string` | 稳定节点 id（`n0`, `n1`…），由 `assignNodeIds` 分配 |
| `component` | `string` | 组件名，如 `'Column'`、`'Text'` |
| `params` | `Expression[]` | 构造参数 |
| `children` | `UIChildNode[]` | 子节点 |
| `styleCalls` | `StyleCall[]` | 链式样式调用 |
| `eventCalls` | `EventCall[]` | 链式事件调用 |

#### `IfNode`

`if/else` 控制节点，模板阶段翻译为 `wx:if` / `wx:else`。`elseChildren` 承载 else 分支；else-if 链表示为 `elseChildren` 中嵌套的 `IfNode`。

#### `ForEachNode`

`ForEach` 控制节点，模板阶段翻译为 `wx:for`。`items` 为被遍历的数组表达式，`itemName` 为迭代变量名（→ `wx:for-item`），`indexName?` 为下标变量名（→ `wx:for-index`）。

#### `UIChildNode = UINode | IfNode | ForEachNode`

UI 树子节点。

#### `StateField`

`@State` 字段：`name`、`type`（序列化类型文本）、`initialValue?`（编译期静态表达式）、`watch?`（`@Watch` 回调方法名）。

#### `PropField`

`@Prop` / `@Link` / 普通成员字段：`name`、`type`、`kind: 'prop' | 'link' | 'plain'`、`initialValue?`。

#### `LifecycleHooks`

生命周期钩子，值为方法体源码文本（已序列化）；存在对应字段即表示组件声明了该钩子：`aboutToAppear?`、`aboutToDisappear?`、`onPageShow?`、`onPageHide?`、`onDidBuild?`。

#### `MethodDecl`

普通方法（事件处理等）：`name`、`params: string[]`、`body: string`。

#### `ComponentModel`

组件模型——编译器核心 IR。一个 `.ets` 文件中每个 `struct` 组件对应一个。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `name` | `string` | struct 名 |
| `isEntry` | `boolean` | 是否有 `@Entry` 标记（页面） |
| `entryOptions?` | `Record<string, unknown>` | `@Entry({...})` 的静态配置参数，仅页面组件存在 |
| `states` | `StateField[]` | |
| `props` | `PropField[]` | |
| `lifecycle` | `LifecycleHooks` | |
| `methods` | `MethodDecl[]` | |
| `buildTree` | `UINode` | `build()` 的 UI 结构树 |
| `builders` | `Record<string, UINode>` | `@Builder` 方法：方法名 → UI 结构树 |

### 节点 id 分配与遍历（node-ids.ts）

#### `assignNodeIds(tree: UINode): UINode`

按深度优先（先序）为 UI 树中每个节点分配稳定 id：`n0`, `n1`…。控制节点（if / foreach）同样参与编号。id 用于样式类名与事件名生成。相同结构的树多次分配结果一致。就地写入各节点的 `id` 字段并返回整棵树。

#### `walkUIChildren(node: UIChildNode, visit: (node) => void): void`

深度优先遍历单个 UI 子树（含 `if` 的 `elseChildren`）。

#### `walkModelTrees(model: ComponentModel, visit: (node) => void): void`

遍历 `ComponentModel` 中的全部 UI 树（`buildTree` + `builders`）。

### 校验（validate.ts）

#### `IR_ERROR_CODES`

IR 校验错误码常量（`E1xxx` 段为 IR 结构错误）：

| 常量 | 错误码 | 含义 |
| --- | --- | --- |
| `EMPTY_COMPONENT_NAME` | `E1001` | 组件名为空 |
| `DUPLICATE_FIELD` | `E1002` | 字段重名 |
| `INVALID_NODE` | `E1003` | UI 节点缺少必要字段 |
| `DUPLICATE_NODE_ID` | `E1004` | 节点 id 重复 |
| `INVALID_BINDING` | `E1005` | 绑定表达式缺少状态路径 |

#### `validateIR(model: ComponentModel): Diagnostic[]`

校验 `ComponentModel` 的结构完整性，返回诊断数组（空数组 = 校验通过）。校验项：组件名、字段重名、UI 节点必要字段（组件名 / ForEach 迭代变量名）、节点 id 唯一性、绑定表达式路径。

### 序列化（serialize.ts）

#### `serializeIR(model: ComponentModel): string`

序列化为格式化 JSON 文本（便于缓存文件 diff）。

#### `deserializeIR(json: string): ComponentModel`

从 JSON 文本还原 `ComponentModel`。

## 用法示例

```ts
import {
  assignNodeIds,
  deserializeIR,
  serializeIR,
  validateIR,
  type ComponentModel,
} from '@arkmp/ir';
import { DiagnosticCollector } from '@arkmp/diagnostics';

const model: ComponentModel = {
  name: 'Index',
  isEntry: true,
  states: [],
  props: [],
  lifecycle: {},
  methods: [],
  buildTree: {
    type: 'component',
    component: 'Column',
    params: [],
    children: [],
    styleCalls: [],
    eventCalls: [],
  },
  builders: {},
};

// 分配节点 id（就地写入）
assignNodeIds(model.buildTree);

// 校验结构完整性
const collector = new DiagnosticCollector();
collector.add(validateIR(model));
if (collector.hasErrors()) {
  console.error(collector.format());
}

// 序列化缓存，下次直接反序列化复用
const cached = serializeIR(model);
const restored = deserializeIR(cached);
```

## 测试

```bash
pnpm --filter @arkmp/ir test
```
