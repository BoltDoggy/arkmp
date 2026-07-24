# @arkmp/transform-events

遍历 `ComponentModel` 中的 `buildTree` 与全部 `@Builder` 树，收集 `eventCalls` → 事件表 + 方法表，是 02 篇④管线中的第四条转换链。

## 所属层

L2 transforms（转换链）

## 依赖

- `@arkmp/ir`（workspace）：消费 `ComponentModel` / `UINode` / `UIChildNode` 等 IR 类型。

## 导出 API

### `EventBinding`

单个事件绑定（事件表的一行）：

- `nodeId: string` — 节点 id（如 `n7`；缺省 id 时为确定性回退 id `x0`…）。
- `event: string` — ArkUI 事件名，如 `onClick`。
- `name: string` — 短事件名（去 `on` 前缀、首字母小写），如 `click`。
- `method: string` — 派生的方法名，如 `__n7_click`；WXML 侧据此生成 bind 属性值。

### `TransformEventsResult`

转换结果接口：

- `bindings: EventBinding[]` — 事件表（先序遍历顺序，节点内按 `eventCalls` 声明顺序）。
- `methods: Record<string, string>` — 抽取的事件方法：方法名 → 回调体源码文本（**未改写**，交由 `transform-js` 统一应用赋值改写）。

### `shortEventName(event: string): string`

`onClick` → `click`；非 `on` 前缀的事件名原样返回。

### `deriveMethodName(nodeId: string, event: string): string`

由节点 id 与事件名派生方法名：`'n7'` + `'onClick'` → `'__n7_click'`。

### `transformEvents(model: ComponentModel): TransformEventsResult`

事件转换（02 篇④）。遍历 `buildTree` 与全部 `@Builder` 树，收集 `eventCalls` → 事件表 + 方法表。纯函数，同一 model 多次转换结果完全一致。

## 用法示例

```ts
import { transformEvents } from '@arkmp/transform-events';
import type { ComponentModel } from '@arkmp/ir';

const model: ComponentModel = {
  // ... analyzer 产出的 ComponentModel
} as unknown as ComponentModel;

const { bindings, methods } = transformEvents(model);

// bindings 供 transform-wxml 生成 bindtap="__n7_click" 等绑定属性；
// methods 作为 transformJs(model, { eventMethods: methods }) 的参数传入。
```

## 测试

```bash
pnpm --filter @arkmp/transform-events test
```
