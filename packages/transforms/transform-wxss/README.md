# @arkmp/transform-wxss

把 `build()` UI 结构树中的 `styleCalls` 翻译为 WXSS 类 + 内联样式表，是 `docs/arkui-miniprogram/04-style-mapping.md` 样式转换规则的可执行形式。

## 所属层

L2 transforms（转换链）

## 依赖

- `@arkmp/diagnostics`（workspace）：产出 warning 诊断（白名单外修饰符、未命中枚举值等）。
- `@arkmp/ir`（workspace）：消费 `UINode` / `UIChildNode` / `StyleCall` / `Expression` 等 IR 类型。
- `@arkmp/mapping-styles`（workspace）：查表获取样式修饰符映射（`getStyleMapping`）、枚举解析（`resolveEnum`）、单位换算（`convertUnit` / `DEFAULT_UNIT_RATIO`）。

## 导出 API

### `WXSS_DIAGNOSTIC_CODE`

诊断码常量表（`as const`），均为 warning，不阻断构建：

| 键 | 码 | 含义 |
| --- | --- | --- |
| `UNSUPPORTED_MODIFIER` | `W3101` | 白名单外修饰符，生成注释兜底 |
| `UNKNOWN_ENUM_VALUE` | `W3102` | 枚举值未命中映射 |
| `VISIBILITY_NONE` | `W3103` | `visibility(None)` 建议改写为条件渲染 |
| `LAYOUT_WEIGHT_PARENT` | `W3104` | `layoutWeight` 父容器非 Row/Column |
| `DYNAMIC_SPECIAL` | `W3105` | 特殊修饰符的动态（binding）形式暂不支持内联 |
| `MISSING_NODE_ID` | `W3106` | 节点缺少稳定 id，类名降级为匿名计数 |

### `TransformWxssOptions`

转换选项接口：

- `unitRatio?: number` — vp→rpx 换算系数，默认 2。
- `classPrefix?: string` — 类名前缀，默认 `'arkmp-'`（类名形如 `arkmp-n1`）。

### `TransformWxssResult`

转换结果接口：

- `wxss: string` — 页面 WXSS 文本（类按首次出现顺序输出）。
- `inlineStyles: Record<string, string>` — nodeId → 内联 style 文本（动态样式，供 WXML `style="..."` 使用）。
- `classMap: Record<string, string>` — nodeId → WXSS 类名（含去重复用；供 WXML/emitter 拼 class 使用）。
- `diagnostics: Diagnostic[]` — 诊断列表。

### `transformWxss(buildTree: UINode, options?: TransformWxssOptions): TransformWxssResult`

把 `build()` 的 UI 结构树中的 `styleCalls` 翻译为 WXSS + 内联样式表。总体策略：静态样式提取为 WXSS 类（相同样式组合去重为一个类），动态样式（binding）进入 `inlineStyles` 表，白名单外修饰符生成注释兜底。

## 用法示例

```ts
import { transformWxss } from '@arkmp/transform-wxss';
import type { UINode } from '@arkmp/ir';

const buildTree: UINode = {
  type: 'component',
  component: 'Text',
  id: 'n1',
  params: [],
  children: [],
  styleCalls: [
    { name: 'fontSize', args: [{ kind: 'static', value: 16 }] },
  ],
  eventCalls: [],
};

const { wxss, inlineStyles, classMap, diagnostics } = transformWxss(buildTree);
console.log(wxss);
// .arkmp-n1 {
//   font-size: 32rpx;
// }
```

## 测试

```bash
pnpm --filter @arkmp/transform-wxss test
```
