# @arkmp/transform-wxml

把 `build()` 的 UI 结构树（IR `UINode`）翻译为小程序 WXML 字符串，是 `docs/arkui-miniprogram/03-component-mapping.md` 组件转换规则的可执行形式。

## 所属层

L2 transforms（转换链）

## 依赖

- `@arkmp/diagnostics`（workspace）：产出 error / warning 诊断（不支持的组件、未收录事件等）。
- `@arkmp/ir`（workspace）：消费 `UINode` / `UIChildNode` / `Expression` 等 IR 类型。
- `@arkmp/mapping-components`（workspace）：查表获取组件→标签映射（`getComponentMapping`）与事件→绑定属性映射（`resolveEventMapping`）。

## 导出 API

### `WXML_DIAGNOSTIC_CODE`

诊断码常量表（`as const`），取值：

| 键 | 码 | 含义 |
| --- | --- | --- |
| `UNSUPPORTED_COMPONENT` | `E3001` | 不支持的组件（error） |
| `UNKNOWN_EVENT` | `W3001` | 未收录的事件调用，已跳过（warning） |
| `FOREACH_KEY_FALLBACK` | `W3002` | ForEach 缺少 key 信息，回退 `wx:key="index"`（warning） |
| `MISSING_NODE_ID` | `W3003` | 节点缺少稳定 id，事件名/属性降级为匿名计数（warning） |

### `TransformWxmlOptions`

转换选项接口：

- `indent?: string` — 缩进字符串，默认两个空格。
- `classMap?: Record<string, string>` — nodeId → WXSS 类名（来自 `transform-wxss` 的 `classMap`），与映射表 `baseClass` 合并进节点 `class` 属性（baseClass 在前）。
- `inlineStyles?: Record<string, string>` — nodeId → 内联样式文本（来自 `transform-wxss` 的 `inlineStyles`），追加进节点 `style` 属性（静态声明在前）。

### `TransformWxmlResult`

转换结果接口：

- `wxml: string` — WXML 文本。
- `diagnostics: Diagnostic[]` — 诊断列表。

### `transformWxml(buildTree: UINode, options?: TransformWxmlOptions): TransformWxmlResult`

把 `build()` 的 UI 结构树翻译为 WXML 字符串。不支持的组件产生 error 级诊断（调用方应据此阻断构建）。覆盖组件映射、`wx:if`/`wx:elif`/`wx:else` 控制流、`wx:for` 循环、`{{}}` 绑定插值、自定义组件 kebab-case 标签等规则。

### `expressionText(expr: Expression): string`

表达式 → WXML 文本：`static` 字面量原样输出；`binding` 纯路径 → `{{path}}`，带模板则做 `${0}` 占位替换。

## 用法示例

```ts
import { transformWxml } from '@arkmp/transform-wxml';
import type { UINode } from '@arkmp/ir';

const buildTree: UINode = {
  type: 'component',
  component: 'Text',
  id: 'n1',
  params: [{ kind: 'static', value: 'hello' }],
  children: [],
  styleCalls: [],
  eventCalls: [],
};

const { wxml, diagnostics } = transformWxml(buildTree);
console.log(wxml);
// <text>hello</text>
```

## 测试

```bash
pnpm --filter @arkmp/transform-wxml test
```
