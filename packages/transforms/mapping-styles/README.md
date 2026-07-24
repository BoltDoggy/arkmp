# @arkmp/mapping-styles

样式白名单 + vp→rpx 单位换算（纯数据/纯函数）：04 篇样式转换规则的机器可读形式，供 `transform-wxss` 等上层包消费。

## 所属层

L2 transforms（四条转换链 + 映射数据包）

## 依赖

无外部依赖。`package.json` 仅有构建/测试相关 devDependencies（`tsdown`、`typescript`、`vitest`），无任何 `workspace:*` 依赖。

## 导出 API

### `DEFAULT_UNIT_RATIO`

```ts
const DEFAULT_UNIT_RATIO = 2;
```

默认 vp→rpx 换算系数（750rpx 基准 ≈ 360~375vp 视宽）。

### `StyleValueKind`

```ts
type StyleValueKind = 'length' | 'color' | 'number' | 'string' | 'enum' | 'special';
```

值类别：`length`（vp × 系数 → rpx）、`color`、`number`、`string`（原样透传）、`enum`（经 enumMap 映射）、`special`（由 `transform-wxss` 按修饰符名特判）。

### `StyleMappingEntry`

```ts
interface StyleMappingEntry {
  name: string;
  css?: string;
  value: StyleValueKind;
  enumMap?: Record<string, string>;
  note?: string;
}
```

白名单条目，主键为 `name`（ArkUI 链式修饰符名）。

### 枚举映射常量

以下常量均为 `Record<string, string>`，供 `StyleMappingEntry.enumMap` 引用：

- **`FLEX_ALIGN_MAP`** — `FlexAlign` → `justify-content`（`Start` → `flex-start` 等）。
- **`CROSS_ALIGN_MAP`** — `HorizontalAlign` / `VerticalAlign` → `align-items`。
- **`FONT_WEIGHT_MAP`** — `FontWeight` → `font-weight`（`Regular` → `400`、`Medium` → `500` 等）。
- **`FONT_STYLE_MAP`** — `FontStyle` → `font-style`（`Normal`、`Italic`）。
- **`TEXT_ALIGN_MAP`** — `TextAlign` → `text-align`。
- **`VISIBILITY_MAP`** — `Visibility` → `visibility`（`None` 由 `transform-wxss` 特判为条件渲染建议）。
- **`ALIGN_SELF_MAP`** — `Alignment`（`.align()`）→ `align-self`。

### `STYLE_WHITELIST`

```ts
const STYLE_WHITELIST: readonly StyleMappingEntry[];
```

样式属性白名单（04 篇「样式属性白名单映射表」+「布局属性」），顺序即文档顺序。含可直接映射项（`width`、`height`、`backgroundColor` 等）、需特殊换算项（`padding`、`border`、`linearGradient` 等）及布局属性（`justifyContent`、`alignItems`）。

### `STYLE_WHITELIST_MAP`

```ts
const STYLE_WHITELIST_MAP: ReadonlyMap<string, StyleMappingEntry>;
```

修饰符名 → 白名单条目的查找表。

### `getStyleMapping(name: string): StyleMappingEntry | undefined`

查询白名单；未收录（白名单外）返回 `undefined`。

### `enumTail(value: string): string`

取枚举末段：`'FlexAlign.SpaceBetween'` → `'SpaceBetween'`；`'SpaceBetween'` 原样返回。

### `resolveEnum(enumMap: Record<string, string>, value: string): string | undefined`

解析枚举映射（内部调用 `enumTail`）；未命中返回 `undefined`。

### `convertUnit(value: number | string, unitRatio?: number): string`

vp→rpx 单位换算。数值按 `value × unitRatio` 换算为 `N rpx`（`0` 输出 `'0'`）；百分比或已带单位的字符串原样透传；纯数字字符串按数值换算。`unitRatio` 默认为 `DEFAULT_UNIT_RATIO`。

## 用法示例

数据结构与换算片段：

```ts
import {
  getStyleMapping,
  resolveEnum,
  convertUnit,
  FONT_WEIGHT_MAP,
} from '@arkmp/mapping-styles';

const width = getStyleMapping('width');
// { name: 'width', css: 'width', value: 'length' }

// 16vp → 32rpx
convertUnit(16); // '32rpx'
convertUnit(0);  // '0'
convertUnit('50%'); // '50%'

// 枚举解析
resolveEnum(FONT_WEIGHT_MAP, 'FontWeight.Bold'); // 'bold'
```

## 测试

```bash
pnpm --filter @arkmp/mapping-styles test
```
