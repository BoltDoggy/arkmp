# @arkmp/transform-js

把 `ComponentModel`（IR）翻译为小程序页面/组件 `.js` 产物文本（`createPage` / `createComponent` 调用），覆盖 05 篇装饰器转换规则与赋值改写。

## 所属层

L2 transforms（转换链）

## 依赖

- `@arkmp/diagnostics`（workspace）：产出 warning 诊断（非静态初始值、改写降级等）。
- `@arkmp/ir`（workspace）：消费 `ComponentModel` / `StateField` / `PropField` / `Expression` 等 IR 类型。
- `typescript`（第三方）：赋值改写器（`rewrite.ts`）使用 TypeScript Compiler API 扫描方法体 AST。

## 导出 API

### `transformJs(model: ComponentModel, options?: TransformJsOptions): TransformJsResult`

核心转换函数。输入 `ComponentModel`，输出 `createPage`/`createComponent` 调用文本。

- `options.isPage?: boolean` — 强制按页面/组件产物生成；缺省取 `model.isEntry`。
- `options.eventMethods?: Record<string, string>` — `transform-events` 抽取的事件方法（方法名 → 回调体源码），合并进 `methods`（事件方法排在声明方法之后，统一应用赋值改写）。

返回 `{ js: string; diagnostics: Diagnostic[] }`。

产物包含：`properties`（`@Prop`/`@Link`）、`state`（`@State` 初始值表）、`watch`（`@Watch`）、`methods`（生命周期钩子 + `@Link` 桥接方法 `__set_<name>` + 声明方法 + 事件方法）。方法体中的 `this.<state> = v` 赋值由 `rewriteBody` 统一改写为 `this.__set(...)` / `this.__set_<link>(...)` 桥接调用。

### `TransformJsOptions`

见上文 `options` 参数。

### `TransformJsResult`

- `js: string` — JS 产物文本。
- `diagnostics: Diagnostic[]` — 诊断列表。

### `TRANSFORM_JS_WARNING_CODES`

诊断码常量表（`as const`）：

| 键 | 码 | 含义 |
| --- | --- | --- |
| `NON_STATIC_INITIAL_VALUE` | `W2002` | `@State`/`@Prop` 初始值不是编译期静态表达式，降级为 null |

### `rewriteBody(body: string, targets: RewriteTargets): RewriteResult`

赋值改写器（05 篇「编译期改写」）。用 TypeScript Compiler API 扫描方法体源码文本，把对 `@State` / `@Link` 字段的顶层赋值改写为 runtime 桥接调用：

- `this.count = 1` → `this.__set('count', 1)`
- `this.count++` → `this.__set('count', this.count + 1)`
- `this.count += 2` → `this.__set('count', this.count + (2))`
- `this.user.name = 'x'` → `this.__set('user.name', 'x')`
- `this.list[0] = 9` → `this.__set('list[0]', 9)`
- `@Link`：`this.isOn = true` → `this.__set_isOn(true)`

`body` 为方法/回调体源码文本（不含外层花括号），纯函数；无法改写的写法保留原文并给出 warning。

### `RewriteTargets`

改写目标接口：

- `states: ReadonlySet<string>` — `@State` 字段名集合。
- `links: ReadonlySet<string>` — `@Link` 字段名集合。

### `RewriteResult`

改写结果接口：

- `code: string` — 改写后代码。
- `warnings: RewriteWarning[]` — warning 列表。

### `RewriteWarning`

- `code: string` — 诊断码。
- `message: string` — 描述。

### `REWRITE_WARNING_CODES`

改写诊断码常量表（`as const`）：

| 键 | 码 | 含义 |
| --- | --- | --- |
| `DYNAMIC_FALLBACK` | `W2001` | 动态键/无法静态改写的赋值，降级运行时 Proxy 兜底 |

## 用法示例

```ts
import { transformJs } from '@arkmp/transform-js';
import type { ComponentModel } from '@arkmp/ir';

const model: ComponentModel = {
  // ... analyzer 产出的 ComponentModel
} as unknown as ComponentModel;

const { js, diagnostics } = transformJs(model);
// js → createPage({ state: {...}, methods: {...} });
```

单独使用赋值改写器：

```ts
import { rewriteBody } from '@arkmp/transform-js';

const { code, warnings } = rewriteBody(
  'this.count = this.count + 1;',
  { states: new Set(['count']), links: new Set() },
);
console.log(code);
// this.__set('count', this.count + 1);
```

## 测试

```bash
pnpm --filter @arkmp/transform-js test
```
