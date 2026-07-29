/**
 * 组件映射表（纯数据）：docs/arkui-miniprogram/03-component-mapping.md 的机器可读形式。
 *
 * 覆盖 03 篇全部已映射组件、runtime 内置组件与标记不支持的组件。
 * 本包零依赖、无副作用，供 transform-wxml 等上层包消费。
 *
 * 数据来源约定（09 篇）：组件链式 API 清单以 OpenHarmony `arkui_ace_engine`
 * 仓 `frameworks/bridge/declarative_frontend/jsview/` 的 JSBind 注册为 ground truth；
 * 本表为 03 篇规则的最小覆盖，扩充时应以该清单核对。
 */

/** 组件支持状态：mapped=编译期直接映射；runtime=由 @arkmp/runtime 内置组件承载；unsupported=暂不支持。 */
export type ComponentSupport = 'mapped' | 'runtime' | 'unsupported';

/**
 * 构造参数处理规则。
 * - `arg`：数字表示位置参数下标，字符串表示对象参数的键（如 `Column({ space })` 的 `'space'`）。
 * - `target`：
 *   - `text`：作为标签文本内容（`Text('内容')`）；
 *   - `attribute`：写入标签属性（`Image(src)` → `src="..."`）；
 *   - `style`：转为行内样式声明（`Column({ space })` → `style="gap:..."`，长度按 vp→rpx 换算）。
 */
export interface ComponentParamRule {
  arg: number | string;
  target: 'text' | 'attribute' | 'style';
  /** target 为 attribute/style 时的目标名（属性名或 CSS 属性名） */
  name?: string;
}

/** 事件绑定映射：ArkUI 事件 → 小程序 bind 属性与事件名后缀（方法名 `__{nodeId}_{suffix}`）。 */
export interface EventMapping {
  /** WXML 绑定属性名，如 `bindtap` */
  bind: string;
  /** 事件名后缀，如 `click`（方法名 `__n7_click`） */
  suffix: string;
  /** 备注（对应 03 篇说明） */
  note?: string;
}

/** 链式调用 → 标签属性的映射（如 `Image.objectFit` → `mode`）。 */
export interface StyleAttributeRule {
  /** ArkUI 链式方法名 */
  name: string;
  /** 目标标签属性名 */
  attribute: string;
  /** 枚举值映射（键取枚举末段，如 `Cover`；也兼容全名 `ImageFit.Cover`） */
  enumMap?: Record<string, string>;
}

/** 单条组件映射。 */
export interface ComponentMapping {
  /** ArkUI 组件名（表的主键） */
  arkui: string;
  support: ComponentSupport;
  /** 小程序标签（mapped/runtime 时必填） */
  tag?: string;
  /** runtime 基础 class（可选，如 `arkmp-col`） */
  baseClass?: string;
  /** 额外的静态标签属性（如 `scroll-view` 的 `scroll-y`） */
  tagAttributes?: Record<string, string>;
  /** 构造参数处理规则 */
  params?: ComponentParamRule[];
  /** 组件级事件覆盖（如 `TextInput.onChange` → `bindinput`），键为 ArkUI 事件名 */
  eventOverrides?: Record<string, EventMapping>;
  /** 链式调用 → 标签属性（如 `objectFit` → `mode`） */
  styleAttributes?: StyleAttributeRule[];
  /** unsupported 时的替代建议（必填） */
  alternative?: string;
  /** 备注（对应 03 篇说明） */
  note?: string;
}

/** `Image.objectFit` 的 `ImageFit` → 小程序 `mode`（03 篇「Image 的 objectFit → mode」）。 */
export const IMAGE_FIT_MODE_MAP: Record<string, string> = {
  Fill: 'scaleToFill',
  Contain: 'aspectFit',
  Cover: 'aspectFill',
  None: 'center',
};

/**
 * 全局事件映射（03 篇「事件绑定」）。
 * 组件级差异（如 `TextInput.onChange` → `bindinput`）见各条目的 `eventOverrides`。
 */
export const EVENT_MAPPING: Record<string, EventMapping> = {
  onClick: { bind: 'bindtap', suffix: 'click' },
  onChange: {
    bind: 'bindchange',
    suffix: 'change',
    note: '值通过 e.detail.value 传递，与 ArkUI 回调参数对齐',
  },
  onTouch: {
    bind: 'bindtouchstart',
    suffix: 'touch',
    note: 'bindtouchstart/move/end 分发到同一处理方法',
  },
};

/** 手势事件映射（`gesture(...)` 参数，03 篇「事件绑定」）。 */
export const GESTURE_EVENT_MAPPING: Record<string, EventMapping> = {
  TapGesture: { bind: 'bindtap', suffix: 'tap', note: '双击编译为 runtime 双击识别' },
  LongPressGesture: { bind: 'bindlongpress', suffix: 'longpress' },
  PanGesture: {
    bind: 'bindtouchstart',
    suffix: 'pan',
    note: 'runtime 手势模块（touch 事件序列换算）',
  },
};

/**
 * 组件映射表（03 篇全部条目）。
 * unsupported 条目收录并给出替代建议。
 */
export const COMPONENT_MAPPINGS: readonly ComponentMapping[] = [
  // ── 布局容器（03 篇「布局容器：映射为 view + 基础类」） ──
  {
    arkui: 'Column',
    support: 'mapped',
    tag: 'view',
    baseClass: 'arkmp-col',
    params: [{ arg: 'space', target: 'style', name: 'gap' }],
    note: 'display:flex; flex-direction:column',
  },
  {
    arkui: 'Row',
    support: 'mapped',
    tag: 'view',
    baseClass: 'arkmp-row',
    params: [{ arg: 'space', target: 'style', name: 'gap' }],
    note: 'display:flex; flex-direction:row',
  },
  {
    arkui: 'Stack',
    support: 'mapped',
    tag: 'view',
    baseClass: 'arkmp-stack',
    note: 'position:relative，子节点 position:absolute',
  },
  {
    arkui: 'Flex',
    support: 'mapped',
    tag: 'view',
    baseClass: 'arkmp-flex',
    note: 'display:flex; flex-wrap:wrap',
  },
  {
    arkui: 'Scroll',
    support: 'mapped',
    tag: 'scroll-view',
    baseClass: 'arkmp-scroll',
    tagAttributes: { 'scroll-y': 'true' },
  },
  {
    arkui: 'List',
    support: 'mapped',
    tag: 'scroll-view',
    tagAttributes: { 'scroll-y': 'true', enhanced: 'true' },
  },
  {
    arkui: 'Grid',
    support: 'mapped',
    tag: 'view',
    baseClass: 'arkmp-grid',
    note: 'display:grid（CSS grid）',
  },
  { arkui: 'Swiper', support: 'mapped', tag: 'swiper' },

  // ── 基础组件（03 篇「基础组件映射表」） ──
  {
    arkui: 'Text',
    support: 'mapped',
    tag: 'text',
    params: [{ arg: 0, target: 'text' }],
  },
  {
    arkui: 'Image',
    support: 'mapped',
    tag: 'image',
    params: [{ arg: 0, target: 'attribute', name: 'src' }],
    styleAttributes: [{ name: 'objectFit', attribute: 'mode', enumMap: IMAGE_FIT_MODE_MAP }],
  },
  {
    arkui: 'Button',
    support: 'mapped',
    tag: 'view',
    baseClass: 'arkmp-btn',
    params: [{ arg: 0, target: 'text' }],
    note: '纯文本 Button → view + 按压态样式；开放能力封装（如 ShareButton）→ 真 button',
  },
  {
    arkui: 'TextInput',
    support: 'mapped',
    tag: 'input',
    baseClass: 'arkmp-input',
    params: [{ arg: 'placeholder', target: 'attribute', name: 'placeholder' }],
    styleAttributes: [{ name: 'value', attribute: 'value' }],
    eventOverrides: { onChange: { bind: 'bindinput', suffix: 'change' } },
  },
  {
    arkui: 'TextArea',
    support: 'mapped',
    tag: 'textarea',
    baseClass: 'arkmp-textarea',
    styleAttributes: [{ name: 'value', attribute: 'value' }],
    eventOverrides: { onChange: { bind: 'bindinput', suffix: 'change' } },
  },
  {
    arkui: 'Toggle',
    support: 'mapped',
    tag: 'switch',
    note: 'Toggle({ type: Switch }) → switch',
  },
  { arkui: 'Checkbox', support: 'mapped', tag: 'checkbox' },
  {
    arkui: 'Radio',
    support: 'mapped',
    tag: 'radio',
    note: '编译期收集同组 Radio 生成 radio-group 包裹（由上层管线负责）',
  },
  { arkui: 'Slider', support: 'mapped', tag: 'slider' },
  { arkui: 'Progress', support: 'mapped', tag: 'progress' },
  {
    arkui: 'LoadingProgress',
    support: 'runtime',
    tag: 'arkmp-loading',
    note: 'runtime 内置加载组件',
  },
  { arkui: 'Divider', support: 'mapped', tag: 'view', baseClass: 'arkmp-divider' },
  {
    arkui: 'Blank',
    support: 'mapped',
    tag: 'view',
    tagAttributes: { style: 'flex:1' },
  },
  {
    arkui: 'Badge',
    support: 'runtime',
    tag: 'arkmp-badge',
    note: 'runtime 内置角标组件',
  },
  {
    arkui: 'Tabs',
    support: 'runtime',
    tag: 'arkmp-tabs',
    note: 'runtime Tabs 组件（基于 swiper + 自定义 tab 栏）',
  },
  {
    arkui: 'TabContent',
    support: 'runtime',
    tag: 'arkmp-tab-content',
    note: 'runtime Tabs 组件的子页签容器',
  },
  { arkui: 'Web', support: 'mapped', tag: 'web-view' },
  { arkui: 'Video', support: 'mapped', tag: 'video' },
  {
    arkui: 'Canvas',
    support: 'mapped',
    tag: 'canvas',
    note: 'canvas-id 由节点 id 自动分配（canvas-n3 形式）',
  },

  // ── 暂不支持直接映射（03 篇「暂不支持直接映射的 ArkUI 组件」） ──
  {
    arkui: 'Navigation',
    support: 'unsupported',
    alternative: '编译为小程序路由（见 06 篇），页面对应关系由工程配置声明',
  },
  {
    arkui: 'NavDestination',
    support: 'unsupported',
    alternative: '编译为独立小程序页面，通过路由跳转（见 06 篇）',
  },
  {
    arkui: 'Refresh',
    support: 'unsupported',
    alternative:
      '页面级下拉：页面 json enablePullDownRefresh + onPullDownRefresh；容器级下拉：runtime 自绘',
  },
  {
    arkui: 'WaterFlow',
    support: 'unsupported',
    alternative: '用两个 Column 分列模拟瀑布流，或等待 runtime 瀑布流组件',
  },
  {
    arkui: 'RelativeContainer',
    support: 'unsupported',
    alternative: '改用 Stack + position 定位，或 Row/Column 嵌套布局',
  },
];

/** 组件名 → 映射条目。 */
export const COMPONENT_MAPPING_MAP: ReadonlyMap<string, ComponentMapping> = new Map(
  COMPONENT_MAPPINGS.map((m) => [m.arkui, m]),
);

/** 查询组件映射；未收录返回 undefined（调用方按自定义组件或报错处理）。 */
export function getComponentMapping(arkui: string): ComponentMapping | undefined {
  return COMPONENT_MAPPING_MAP.get(arkui);
}

/** 解析事件映射：组件级覆盖优先，其次全局表；未收录返回 undefined。 */
export function resolveEventMapping(
  mapping: ComponentMapping | undefined,
  eventName: string,
): EventMapping | undefined {
  return mapping?.eventOverrides?.[eventName] ?? EVENT_MAPPING[eventName];
}
