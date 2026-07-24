# @arkmp/mapping-components

组件映射表（纯数据）：将 ArkUI 声明式组件映射到微信小程序标签及属性规则，是 03 篇组件转换规则的机器可读形式，供 `transform-wxml` 等上层包消费。

## 所属层

L2 transforms（四条转换链 + 映射数据包）

## 依赖

无外部依赖。`package.json` 仅有构建/测试相关 devDependencies（`tsdown`、`typescript`、`vitest`），无任何 `workspace:*` 依赖。

## 导出 API

### `ComponentSupport`

```ts
type ComponentSupport = 'mapped' | 'runtime' | 'unsupported';
```

组件支持状态：`mapped` = 编译期直接映射；`runtime` = 由 `@arkmp/runtime` 内置组件承载；`unsupported` = 暂不支持。

### `ComponentParamRule`

```ts
interface ComponentParamRule {
  arg: number | string;
  target: 'text' | 'attribute' | 'style';
  name?: string;
}
```

构造参数处理规则。`arg` 为位置参数下标（数字）或对象参数的键（字符串）；`target` 决定写入目标：`text`（标签文本）、`attribute`（标签属性）、`style`（行内样式）；`name` 为目标属性名或 CSS 属性名。

### `EventMapping`

```ts
interface EventMapping {
  bind: string;
  suffix: string;
  note?: string;
}
```

事件绑定映射：ArkUI 事件 → 小程序 `bind` 属性与事件名后缀（运行时方法名形如 `__{nodeId}_{suffix}`）。

### `StyleAttributeRule`

```ts
interface StyleAttributeRule {
  name: string;
  attribute: string;
  enumMap?: Record<string, string>;
}
```

链式调用 → 标签属性映射（如 `Image.objectFit` → `mode`）。`enumMap` 的键取枚举末段（如 `Cover`），也兼容全名（如 `ImageFit.Cover`）。

### `ComponentMapping`

```ts
interface ComponentMapping {
  arkui: string;
  support: ComponentSupport;
  tag?: string;
  baseClass?: string;
  tagAttributes?: Record<string, string>;
  params?: ComponentParamRule[];
  eventOverrides?: Record<string, EventMapping>;
  styleAttributes?: StyleAttributeRule[];
  alternative?: string;
  note?: string;
}
```

单条组件映射，表的主键为 `arkui`（ArkUI 组件名）。

### `IMAGE_FIT_MODE_MAP`

```ts
const IMAGE_FIT_MODE_MAP: Record<string, string>;
```

`Image.objectFit` 的 `ImageFit` 枚举 → 小程序 `mode` 映射（`Fill` → `scaleToFill`，`Contain` → `aspectFit`，`Cover` → `aspectFill`，`None` → `center`）。

### `EVENT_MAPPING`

```ts
const EVENT_MAPPING: Record<string, EventMapping>;
```

全局事件映射表（`onClick`、`onChange`、`onTouch`），组件级差异见各条目的 `eventOverrides`。

### `GESTURE_EVENT_MAPPING`

```ts
const GESTURE_EVENT_MAPPING: Record<string, EventMapping>;
```

手势事件映射（`TapGesture`、`LongPressGesture`、`PanGesture`）。

### `COMPONENT_MAPPINGS`

```ts
const COMPONENT_MAPPINGS: readonly ComponentMapping[];
```

组件映射表（03 篇全部条目），涵盖布局容器、基础组件、runtime 内置组件及暂不支持条目。

### `COMPONENT_MAPPING_MAP`

```ts
const COMPONENT_MAPPING_MAP: ReadonlyMap<string, ComponentMapping>;
```

组件名 → 映射条目的查找表。

### `getComponentMapping(arkui: string): ComponentMapping | undefined`

查询组件映射；未收录返回 `undefined`（调用方按自定义组件或报错处理）。

### `resolveEventMapping(mapping: ComponentMapping | undefined, eventName: string): EventMapping | undefined`

解析事件映射：组件级 `eventOverrides` 优先，其次全局 `EVENT_MAPPING`；未收录返回 `undefined`。

## 用法示例

数据结构片段（查询 `Column` 与 `TextInput.onChange` 事件）：

```ts
import {
  getComponentMapping,
  resolveEventMapping,
} from '@arkmp/mapping-components';

const column = getComponentMapping('Column');
// {
//   arkui: 'Column',
//   support: 'mapped',
//   tag: 'view',
//   baseClass: 'arkmp-col',
//   params: [{ arg: 'space', target: 'style', name: 'gap' }],
//   note: 'display:flex; flex-direction:column',
// }

const input = getComponentMapping('TextInput')!;
const onChange = resolveEventMapping(input, 'onChange');
// { bind: 'bindinput', suffix: 'change' }（组件级覆盖，而非全局 bindchange）
```

## 测试

```bash
pnpm --filter @arkmp/mapping-components test
```
