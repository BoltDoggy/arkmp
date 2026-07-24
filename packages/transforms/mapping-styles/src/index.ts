/**
 * 样式白名单 + vp→rpx 单位换算（纯数据/纯函数）：
 * docs/arkui-miniprogram/04-style-mapping.md 的机器可读形式。
 *
 * 三类条目（04 篇）：
 * - `direct`：可直接映射（值按 valueKind 换算后即 CSS 声明）；
 * - `special`：需特殊换算（对象参数展开、多调用组合等，由 transform-wxss 特判）；
 * - 白名单外：不在表中的修饰符，编译期 warning + 注释兜底，不阻断构建。
 *
 * 数据来源约定（09 篇）：默认样式值以 OpenHarmony `ark_theme/` 与
 * `components_ng/` 主题定义为准；本表为 04 篇规则的最小覆盖。
 */

/** 默认 vp→rpx 换算系数（750rpx 基准 ≈ 360~375vp 视宽，04 篇「单位换算」）。 */
export const DEFAULT_UNIT_RATIO = 2;

/**
 * 值类别：
 * - `length`：vp 数值 × unitRatio → rpx；百分比/带单位字符串原样透传；
 * - `color`：颜色值原样透传；
 * - `number`：数值原样透传；
 * - `string`：字符串原样透传；
 * - `enum`：枚举值经 enumMap 映射（键取枚举末段，如 `SpaceBetween`）；
 * - `special`：由 transform-wxss 按修饰符名特判（对象参数、组合规则等）。
 */
export type StyleValueKind = 'length' | 'color' | 'number' | 'string' | 'enum' | 'special';

/** 白名单条目。 */
export interface StyleMappingEntry {
  /** ArkUI 修饰符名（链式方法名，表的主键） */
  name: string;
  /** 目标 CSS 属性（special 且无固定属性时省略） */
  css?: string;
  /** 值类别 */
  value: StyleValueKind;
  /** 枚举值映射（value 为 enum 时必填） */
  enumMap?: Record<string, string>;
  /** 备注（对应 04 篇说明） */
  note?: string;
}

/** `FlexAlign` → `justify-content`。 */
export const FLEX_ALIGN_MAP: Record<string, string> = {
  Start: 'flex-start',
  Center: 'center',
  End: 'flex-end',
  SpaceBetween: 'space-between',
  SpaceAround: 'space-around',
  SpaceEvenly: 'space-evenly',
};

/** `HorizontalAlign` / `VerticalAlign` → `align-items`。 */
export const CROSS_ALIGN_MAP: Record<string, string> = {
  Start: 'flex-start',
  Center: 'center',
  End: 'flex-end',
  Stretch: 'stretch',
  Baseline: 'baseline',
};

/** `FontWeight` → `font-weight`。 */
export const FONT_WEIGHT_MAP: Record<string, string> = {
  Lighter: 'lighter',
  Normal: 'normal',
  Regular: '400',
  Medium: '500',
  Bold: 'bold',
  Bolder: 'bolder',
};

/** `FontStyle` → `font-style`。 */
export const FONT_STYLE_MAP: Record<string, string> = {
  Normal: 'normal',
  Italic: 'italic',
};

/** `TextAlign` → `text-align`。 */
export const TEXT_ALIGN_MAP: Record<string, string> = {
  Start: 'start',
  Center: 'center',
  End: 'end',
  Left: 'left',
  Right: 'right',
  Justify: 'justify',
};

/** `Visibility` → `visibility`（`None` 由 transform-wxss 特判为条件渲染建议）。 */
export const VISIBILITY_MAP: Record<string, string> = {
  Visible: 'visible',
  Hidden: 'hidden',
};

/** `Alignment`（`.align()`）→ `align-self`。 */
export const ALIGN_SELF_MAP: Record<string, string> = {
  Top: 'flex-start',
  TopStart: 'flex-start',
  TopEnd: 'flex-start',
  Center: 'center',
  Bottom: 'flex-end',
  BottomStart: 'flex-end',
  BottomEnd: 'flex-end',
  Start: 'flex-start',
  End: 'flex-end',
};

/**
 * 样式属性白名单（04 篇「样式属性白名单映射表」+「布局属性」）。
 * 顺序即文档顺序；查找用 STYLE_WHITELIST_MAP。
 */
export const STYLE_WHITELIST: readonly StyleMappingEntry[] = [
  // ── 可直接映射 ──
  { name: 'width', css: 'width', value: 'length' },
  { name: 'height', css: 'height', value: 'length' },
  { name: 'padding', css: 'padding', value: 'special', note: '单值/对象 { top, left } 两种参数形式' },
  { name: 'margin', css: 'margin', value: 'special', note: '同 padding' },
  { name: 'backgroundColor', css: 'background-color', value: 'color' },
  { name: 'borderRadius', css: 'border-radius', value: 'length' },
  { name: 'fontSize', css: 'font-size', value: 'length', note: 'fp 按 vp 同规则换算' },
  { name: 'fontColor', css: 'color', value: 'color' },
  { name: 'fontWeight', css: 'font-weight', value: 'enum', enumMap: FONT_WEIGHT_MAP, note: '数值字面值原样透传' },
  { name: 'fontStyle', css: 'font-style', value: 'enum', enumMap: FONT_STYLE_MAP },
  { name: 'textAlign', css: 'text-align', value: 'enum', enumMap: TEXT_ALIGN_MAP },
  { name: 'opacity', css: 'opacity', value: 'number' },
  { name: 'zIndex', css: 'z-index', value: 'number' },

  // ── 需特殊换算（transform-wxss 特判） ──
  { name: 'constraintSize', value: 'special', note: '{ maxWidth, ... } 展开为 max-width 等' },
  { name: 'backgroundImage', css: 'background-image', value: 'special', note: '$r 资源路径解析为产物 assets 路径' },
  { name: 'border', css: 'border', value: 'special', note: '{ width, color, style, radius } 组合' },
  { name: 'maxLines', value: 'special', note: '与 textOverflow 组合：单行 text-overflow；多行 -webkit-line-clamp' },
  { name: 'textOverflow', value: 'special', note: 'Ellipsis 与 maxLines 组合' },
  { name: 'visibility', css: 'visibility', value: 'enum', enumMap: VISIBILITY_MAP, note: 'None 改写为条件渲染（编译期 warning）' },
  { name: 'position', value: 'special', note: '{ x, y } → position:absolute; left/top' },
  { name: 'offset', value: 'special', note: 'transform: translate()' },
  { name: 'scale', value: 'special', note: 'transform 组合' },
  { name: 'rotate', value: 'special', note: 'transform 组合' },
  { name: 'shadow', css: 'box-shadow', value: 'special', note: '参数近似换算' },
  { name: 'linearGradient', value: 'special', note: 'background: linear-gradient(...)' },
  { name: 'aspectRatio', css: 'aspect-ratio', value: 'number', note: '基础库低版本降级 padding hack（由 emitter 处理）' },
  { name: 'layoutWeight', value: 'special', note: 'flex: N；父容器非 Row/Column 时编译期 warning' },
  { name: 'align', css: 'align-self', value: 'enum', enumMap: ALIGN_SELF_MAP },

  // ── 布局属性（04 篇「布局属性」） ──
  { name: 'justifyContent', css: 'justify-content', value: 'enum', enumMap: FLEX_ALIGN_MAP },
  { name: 'alignItems', css: 'align-items', value: 'enum', enumMap: CROSS_ALIGN_MAP, note: '编译器按容器轴向落 align-items/justify-content' },

  // ── 组件属性桥接（由 transform-wxml 消费为标签属性，WXSS 侧忽略） ──
  { name: 'objectFit', value: 'special', note: 'Image 专用：由 transform-wxml 转为 mode 属性，不进 WXSS' },
];

/** 修饰符名 → 白名单条目。 */
export const STYLE_WHITELIST_MAP: ReadonlyMap<string, StyleMappingEntry> = new Map(
  STYLE_WHITELIST.map((e) => [e.name, e]),
);

/** 查询白名单；未收录（白名单外）返回 undefined。 */
export function getStyleMapping(name: string): StyleMappingEntry | undefined {
  return STYLE_WHITELIST_MAP.get(name);
}

/** 取枚举末段：`'FlexAlign.SpaceBetween'` → `'SpaceBetween'`；`'SpaceBetween'` 原样返回。 */
export function enumTail(value: string): string {
  const dot = value.lastIndexOf('.');
  return dot === -1 ? value : value.slice(dot + 1);
}

/** 解析枚举映射；未命中返回 undefined。 */
export function resolveEnum(enumMap: Record<string, string>, value: string): string | undefined {
  return enumMap[enumTail(value)];
}

/**
 * vp→rpx 单位换算（04 篇「单位换算」）。
 * - 数值：`value × unitRatio` → `N rpx`；`0` 输出 `0`（不带单位）；
 * - 百分比或已带单位的字符串：原样透传；
 * - 纯数字字符串：按数值换算。
 */
export function convertUnit(value: number | string, unitRatio: number = DEFAULT_UNIT_RATIO): string {
  if (typeof value === 'number') {
    return formatRpx(value, unitRatio);
  }
  const trimmed = value.trim();
  if (trimmed !== '' && !Number.isNaN(Number(trimmed))) {
    return formatRpx(Number(trimmed), unitRatio);
  }
  return trimmed;
}

function formatRpx(vp: number, unitRatio: number): string {
  const rpx = vp * unitRatio;
  if (rpx === 0) return '0';
  // 避免浮点尾差（如 0.1*2=0.30000000000000004），保留两位小数
  const rounded = Math.round(rpx * 100) / 100;
  return `${rounded}rpx`;
}
