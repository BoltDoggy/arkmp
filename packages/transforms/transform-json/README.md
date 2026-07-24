# @arkmp/transform-json

把 `ComponentModel`（IR）翻译为小程序 `.json` 配置对象，是 02 篇⑤ `.json` 产物的生成器。

## 所属层

L2 transforms（转换链）

## 依赖

- `@arkmp/diagnostics`（workspace）：产出 warning 诊断（未识别的 `@Entry` 配置项等）。
- `@arkmp/ir`（workspace）：消费 `ComponentModel` 类型。

## 导出 API

### `TRANSFORM_JSON_WARNING_CODES`

诊断码常量表（`as const`）：

| 键 | 码 | 含义 |
| --- | --- | --- |
| `UNKNOWN_ENTRY_OPTION` | `W5001` | 未识别的 `@Entry` 配置项：无法映射，原样透传 |

### `TransformJsonOptions`

转换选项接口：

- `usingComponents?: Record<string, string>` — 自定义组件引用表（标签名 → 组件路径），由工程层解析后传入。页面与组件产物均会合并为 `usingComponents` 字段。

### `TransformJsonResult`

转换结果接口：

- `json: Record<string, unknown>` — `.json` 配置对象。
- `diagnostics: Diagnostic[]` — 诊断列表。

### `transformJson(model: ComponentModel, options?: TransformJsonOptions): TransformJsonResult`

生成 `.json` 配置对象（02 篇⑤）。`model.isEntry` 决定页面/组件两种形态：

- **组件**（非 `@Entry`）：输出 `{ "component": true }`。
- **页面**（`@Entry`）：`@Entry({...})` 的静态参数映射为页面 json 字段（`title` → `navigationBarTitleText`，`pullRefresh` → `enablePullDownRefresh`）；未识别的配置项原样透传并 warning。`isEntry` 但无 `entryOptions` 时页面 json 为空对象。

`usingComponents` 由调用方（工程层解析组件引用后）通过 `options` 传入，本包只负责合并，不做路径推导。

## 用法示例

```ts
import { transformJson } from '@arkmp/transform-json';
import type { ComponentModel } from '@arkmp/ir';

const model: ComponentModel = {
  isEntry: true,
  entryOptions: { title: '首页', pullRefresh: true },
  // ... 其余字段
} as unknown as ComponentModel;

const { json, diagnostics } = transformJson(model, {
  usingComponents: { 'user-card': '/components/user-card/index' },
});
console.log(json);
// {
//   navigationBarTitleText: '首页',
//   enablePullDownRefresh: true,
//   usingComponents: { 'user-card': '/components/user-card/index' }
// }
```

## 测试

```bash
pnpm --filter @arkmp/transform-json test
```
