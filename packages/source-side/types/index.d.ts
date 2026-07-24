/**
 * @arkmp/types — ArkMP 源码侧（.ets）全局类型声明。
 *
 * 覆盖范围（以 docs/arkui-miniprogram 设计文档为准）：
 * - 装饰器白名单：08 篇"支持的语言特性"表（@Entry/@Component/@State/... 共 14 个）
 * - 组件全局函数与链式修饰符：03 篇组件映射表 + 04 篇样式白名单
 * - ForEach 回调签名：03 篇"控制流翻译"
 * - 路由 API：06 篇"路由适配"
 *
 * 本文件不含 import/export，全部为全局 ambient 声明，模拟 ArkUI 的全局 DSL 命名空间。
 */

// ---------------------------------------------------------------------------
// 装饰器（08 篇装饰器白名单）
// ---------------------------------------------------------------------------

/** @Entry 页面入口选项（编译期用于路由表收集） */
interface ArkEntryOptions {
  /** 页面路由名，编译为 app.json pages 路径 */
  routeName?: string;
}

/**
 * @Entry：标记页面组件。支持裸用（`@Entry`）与带参（`@Entry({ routeName })`）。
 */
declare const Entry: ClassDecorator & ((options?: ArkEntryOptions) => ClassDecorator);

/** @Component：标记自定义组件 */
declare const Component: ClassDecorator;

/** @Observed：标记可被 @ObjectLink 观察的类 */
declare const Observed: ClassDecorator;

/** @State：组件内部状态，改写为 data + setData 桥接 */
declare const State: PropertyDecorator;

/** @Prop：父组件传入的单向同步属性 */
declare const Prop: PropertyDecorator;

/** @Link：父子双向绑定属性 */
declare const Link: PropertyDecorator;

/** @Provide：跨层级提供（跨页面时降级为全局 store，08 篇） */
declare const Provide: PropertyDecorator;

/** @Consume：跨层级消费 */
declare const Consume: PropertyDecorator;

/** @ObjectLink：观察 @Observed 对象属性 */
declare const ObjectLink: PropertyDecorator;

/** @Builder：自定义 UI 构建函数（无状态编译为 template，有状态提升为组件） */
declare const Builder: MethodDecorator;

/** @Styles：通用样式封装，编译期内联展开（04 篇） */
declare const Styles: MethodDecorator;

/**
 * @Extend(Component)：组件级样式封装。参数为目标组件引用。
 * 参数为字面量时内联展开；来自状态时降级为动态样式绑定（04 篇）。
 */
declare function Extend(
  component: (...args: never[]) => unknown,
): (target: (...args: never[]) => void) => void;

/** @Watch('propName')：状态变更回调，参数必须是被观测属性名的字符串字面量 */
declare function Watch(propName: string): MethodDecorator;

/** @StorageLink('key')：与全局存储双向同步的状态 */
declare function StorageLink(key: string): PropertyDecorator;

// ---------------------------------------------------------------------------
// 枚举（03/04 篇出现的对齐与取值）
// ---------------------------------------------------------------------------

/** 主轴对齐（flex justify-content） */
declare enum FlexAlign {
  Start,
  Center,
  End,
  SpaceBetween,
  SpaceAround,
  SpaceEvenly,
}

/** 水平方向对齐（Column 的交叉轴） */
declare enum HorizontalAlign {
  Start,
  Center,
  End,
}

/** 垂直方向对齐（Row 的交叉轴） */
declare enum VerticalAlign {
  Top,
  Center,
  Bottom,
}

/** Stack 子节点 / .align() 使用的九格对齐 */
declare enum Alignment {
  TopStart,
  Top,
  TopEnd,
  Start,
  Center,
  End,
  BottomStart,
  Bottom,
  BottomEnd,
}

/** 可见性（Hidden → visibility:hidden；None 改写为条件渲染，04 篇） */
declare enum Visibility {
  Visible,
  Hidden,
  None,
}

/** Image 缩放模式（03 篇 objectFit → mode 映射） */
declare enum ImageFit {
  Fill,
  Contain,
  Cover,
  None,
  ScaleDown,
}

/** Toggle 类型 */
declare enum ToggleType {
  Checkbox,
  Switch,
  Button,
}

declare enum FontWeight {
  Lighter,
  Normal,
  Regular,
  Medium,
  Bold,
  Bolder,
}

declare enum FontStyle {
  Normal,
  Italic,
}

declare enum TextAlign {
  Start,
  Center,
  End,
  Left,
  Right,
}

declare enum TextOverflow {
  None,
  Clip,
  Ellipsis,
  Marquee,
}

/** 常用颜色常量（字符串值，与 CSS 颜色一致） */
declare enum Color {
  White = '#ffffff',
  Black = '#000000',
  Red = '#ff0000',
  Green = '#00ff00',
  Blue = '#0000ff',
  Gray = '#808080',
  Transparent = '#00000000',
}

// ---------------------------------------------------------------------------
// 资源与基础值类型
// ---------------------------------------------------------------------------

/** 资源引用（$r/$rawfile 返回值），编译期解析为产物 assets 路径 */
interface ArkResource {
  readonly id: string;
  readonly type: 'color' | 'string' | 'media' | 'rawfile';
}

/** 引用应用资源，如 $r('app.media.logo')、$r('app.color.primary') */
declare function $r(value: string): ArkResource;

/** 引用 rawfile 资源 */
declare function $rawfile(value: string): ArkResource;

/** ArkUI 长度值：number 按 vp 处理（编译期 ×2 换算为 rpx），字符串透传（如 '100%'） */
type ArkLength = number | string;

/** 颜色值：Color 枚举或 CSS 颜色字符串 */
type ArkColor = Color | string;

/** 边距参数：单值或四方向对象（04 篇 padding/margin 两种参数形式） */
interface ArkEdgeInsets {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

interface ArkPosition {
  x: number;
  y: number;
}

interface ArkOffset {
  x: number;
  y: number;
}

interface ArkConstraintSize {
  minWidth?: ArkLength;
  maxWidth?: ArkLength;
  minHeight?: ArkLength;
  maxHeight?: ArkLength;
}

interface ArkBorderOptions {
  width?: number | ArkEdgeInsets;
  color?: ArkColor;
  radius?: number;
  style?: 'solid' | 'dashed' | 'dotted';
}

interface ArkShadowOptions {
  radius: number;
  color?: ArkColor;
  offsetX?: number;
  offsetY?: number;
}

interface ArkLinearGradientOptions {
  angle?: number;
  colors: Array<[ArkColor, number]>;
}

interface ArkScaleOptions {
  x?: number;
  y?: number;
}

interface ArkRotateOptions {
  angle: number;
}

// ---------------------------------------------------------------------------
// 事件（03 篇"事件绑定"）
// ---------------------------------------------------------------------------

/** 点击事件（bindtap 回传，经 runtime 规范化） */
interface ArkClickEvent {
  x: number;
  y: number;
  timestamp: number;
}

/** 触摸事件（bindtouchstart/move/end 分发） */
interface ArkTouchEvent {
  type: 'start' | 'move' | 'end';
  x: number;
  y: number;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// 链式修饰符（04 篇样式白名单，流式接口返回 this 类型）
// ---------------------------------------------------------------------------

/**
 * 公共修饰符（04 篇白名单）。Self 为各组件自身的 Attribute 类型，
 * 链式调用保持具体类型不丢失。
 */
interface ArkCommonAttribute<Self> {
  // 尺寸
  width(value: ArkLength): Self;
  height(value: ArkLength): Self;
  constraintSize(value: ArkConstraintSize): Self;
  aspectRatio(value: number): Self;
  // 间距
  padding(value: number | ArkEdgeInsets): Self;
  margin(value: number | ArkEdgeInsets): Self;
  // 背景与边框
  backgroundColor(value: ArkColor): Self;
  backgroundImage(src: ArkResource | string): Self;
  border(value: ArkBorderOptions): Self;
  borderRadius(value: number): Self;
  // 文本
  fontSize(value: number): Self;
  fontColor(value: ArkColor): Self;
  fontWeight(value: FontWeight | number): Self;
  fontStyle(value: FontStyle): Self;
  textAlign(value: TextAlign): Self;
  maxLines(value: number): Self;
  textOverflow(value: { overflow: TextOverflow }): Self;
  // 渲染
  opacity(value: number): Self;
  visibility(value: Visibility): Self;
  zIndex(value: number): Self;
  // 定位与变换
  position(value: ArkPosition): Self;
  offset(value: ArkOffset): Self;
  scale(value: ArkScaleOptions): Self;
  rotate(value: ArkRotateOptions): Self;
  shadow(value: ArkShadowOptions): Self;
  linearGradient(value: ArkLinearGradientOptions): Self;
  // 布局
  layoutWeight(value: number): Self;
  align(value: Alignment): Self;
  // 事件（03 篇"事件绑定"）
  onClick(handler: (event: ArkClickEvent) => void): Self;
  onTouch(handler: (event: ArkTouchEvent) => void): Self;
}

// ---------------------------------------------------------------------------
// 布局容器（03 篇"布局容器"表）
// ---------------------------------------------------------------------------

interface ColumnOptions {
  /** 子组件间距（vp，编译为容器 gap 样式） */
  space?: number;
}

interface RowOptions {
  space?: number;
}

interface FlexOptions {
  wrap?: boolean;
  justifyContent?: FlexAlign;
  alignItems?: VerticalAlign;
}

interface ColumnAttribute extends ArkCommonAttribute<ColumnAttribute> {
  /** 交叉轴对齐（Column 主轴为纵向，交叉轴用 HorizontalAlign） */
  alignItems(value: HorizontalAlign): ColumnAttribute;
  /** 主轴对齐 */
  justifyContent(value: FlexAlign): ColumnAttribute;
}

interface RowAttribute extends ArkCommonAttribute<RowAttribute> {
  /** 交叉轴对齐（Row 主轴为横向，交叉轴用 VerticalAlign） */
  alignItems(value: VerticalAlign): RowAttribute;
  justifyContent(value: FlexAlign): RowAttribute;
}

interface StackAttribute extends ArkCommonAttribute<StackAttribute> {
  alignContent(value: Alignment): StackAttribute;
}

interface FlexAttribute extends ArkCommonAttribute<FlexAttribute> {}

interface ScrollAttribute extends ArkCommonAttribute<ScrollAttribute> {
  scrollable(value: 'vertical' | 'horizontal'): ScrollAttribute;
}

interface ListAttribute extends ArkCommonAttribute<ListAttribute> {
  space(value: number): ListAttribute;
}

interface ListItemAttribute extends ArkCommonAttribute<ListItemAttribute> {}

interface GridAttribute extends ArkCommonAttribute<GridAttribute> {
  columnsTemplate(value: string): GridAttribute;
  columnsGap(value: number): GridAttribute;
  rowsGap(value: number): GridAttribute;
}

interface GridItemAttribute extends ArkCommonAttribute<GridItemAttribute> {}

interface SwiperAttribute extends ArkCommonAttribute<SwiperAttribute> {
  autoPlay(value: boolean): SwiperAttribute;
  interval(value: number): SwiperAttribute;
  indicator(value: boolean): SwiperAttribute;
  loop(value: boolean): SwiperAttribute;
  onChange(handler: (index: number) => void): SwiperAttribute;
}

interface TabsAttribute extends ArkCommonAttribute<TabsAttribute> {
  barPosition(value: 'start' | 'end'): TabsAttribute;
  onChange(handler: (index: number) => void): TabsAttribute;
}

interface TabContentAttribute extends ArkCommonAttribute<TabContentAttribute> {
  tabBar(value: string): TabContentAttribute;
}

declare function Column(options?: ColumnOptions, children?: () => void): ColumnAttribute;
declare function Row(options?: RowOptions, children?: () => void): RowAttribute;
declare function Stack(children?: () => void): StackAttribute;
declare function Flex(options?: FlexOptions, children?: () => void): FlexAttribute;
declare function Scroll(children?: () => void): ScrollAttribute;
declare function List(children?: () => void): ListAttribute;
declare function ListItem(children?: () => void): ListItemAttribute;
declare function Grid(children?: () => void): GridAttribute;
declare function GridItem(children?: () => void): GridItemAttribute;
declare function Swiper(children?: () => void): SwiperAttribute;
declare function Tabs(children?: () => void): TabsAttribute;
declare function TabContent(children?: () => void): TabContentAttribute;

// ---------------------------------------------------------------------------
// 基础组件（03 篇"基础组件映射表"）
// ---------------------------------------------------------------------------

interface TextAttribute extends ArkCommonAttribute<TextAttribute> {
  lineHeight(value: number): TextAttribute;
}

interface ImageAttribute extends ArkCommonAttribute<ImageAttribute> {
  objectFit(value: ImageFit): ImageAttribute;
  alt(value: string): ImageAttribute;
}

interface ButtonOptions {
  label?: string;
  type?: 'normal' | 'capsule' | 'circle';
}

interface ButtonAttribute extends ArkCommonAttribute<ButtonAttribute> {
  /** 按钮开放能力（编译为 <button open-type>，03 篇"Button 的特殊处理"） */
  openType(value: 'share' | 'getPhoneNumber'): ButtonAttribute;
}

interface TextInputOptions {
  placeholder?: string;
  text?: string;
}

interface TextInputAttribute extends ArkCommonAttribute<TextInputAttribute> {
  inputType(value: 'text' | 'number' | 'password'): TextInputAttribute;
  maxLength(value: number): TextInputAttribute;
  /** 值变化回调（bindinput，参数与 ArkUI 对齐为字符串值） */
  onChange(handler: (value: string) => void): TextInputAttribute;
}

interface TextAreaOptions {
  placeholder?: string;
  text?: string;
}

interface TextAreaAttribute extends ArkCommonAttribute<TextAreaAttribute> {
  onChange(handler: (value: string) => void): TextAreaAttribute;
}

interface ToggleOptions {
  type: ToggleType;
  isOn?: boolean;
}

interface ToggleAttribute extends ArkCommonAttribute<ToggleAttribute> {
  onChange(handler: (isOn: boolean) => void): ToggleAttribute;
}

interface CheckboxAttribute extends ArkCommonAttribute<CheckboxAttribute> {
  select(value: boolean): CheckboxAttribute;
  onChange(handler: (value: boolean) => void): CheckboxAttribute;
}

interface RadioOptions {
  value: string;
  group: string;
}

interface RadioAttribute extends ArkCommonAttribute<RadioAttribute> {
  checked(value: boolean): RadioAttribute;
  onChange(handler: (value: boolean) => void): RadioAttribute;
}

interface SliderOptions {
  value?: number;
  min?: number;
  max?: number;
  step?: number;
}

interface SliderAttribute extends ArkCommonAttribute<SliderAttribute> {
  onChange(handler: (value: number) => void): SliderAttribute;
}

interface ProgressOptions {
  value: number;
  total?: number;
}

interface ProgressAttribute extends ArkCommonAttribute<ProgressAttribute> {}

interface LoadingProgressAttribute extends ArkCommonAttribute<LoadingProgressAttribute> {}

interface DividerAttribute extends ArkCommonAttribute<DividerAttribute> {
  color(value: ArkColor): DividerAttribute;
}

interface BlankAttribute extends ArkCommonAttribute<BlankAttribute> {}

interface BadgeOptions {
  count: number;
  maxCount?: number;
}

interface BadgeAttribute extends ArkCommonAttribute<BadgeAttribute> {}

interface WebOptions {
  src: string;
}

interface WebAttribute extends ArkCommonAttribute<WebAttribute> {}

interface VideoOptions {
  src: string;
}

interface VideoAttribute extends ArkCommonAttribute<VideoAttribute> {
  muted(value: boolean): VideoAttribute;
  autoPlay(value: boolean): VideoAttribute;
}

interface CanvasOptions {
  id?: string;
}

interface CanvasAttribute extends ArkCommonAttribute<CanvasAttribute> {}

declare function Text(content?: string): TextAttribute;
declare function Image(src: string | ArkResource): ImageAttribute;
declare function Button(label?: string, children?: () => void): ButtonAttribute;
declare function Button(options: ButtonOptions, children?: () => void): ButtonAttribute;
declare function TextInput(options?: TextInputOptions): TextInputAttribute;
declare function TextArea(options?: TextAreaOptions): TextAreaAttribute;
declare function Toggle(options: ToggleOptions): ToggleAttribute;
declare function Checkbox(): CheckboxAttribute;
declare function Radio(options: RadioOptions): RadioAttribute;
declare function Slider(options?: SliderOptions): SliderAttribute;
declare function Progress(options: ProgressOptions): ProgressAttribute;
declare function LoadingProgress(): LoadingProgressAttribute;
declare function Divider(): DividerAttribute;
declare function Blank(): BlankAttribute;
declare function Badge(options: BadgeOptions, children?: () => void): BadgeAttribute;
declare function Web(options: WebOptions): WebAttribute;
declare function Video(options: VideoOptions): VideoAttribute;
declare function Canvas(options?: CanvasOptions): CanvasAttribute;

// ---------------------------------------------------------------------------
// 控制流（03 篇"控制流翻译"）
// ---------------------------------------------------------------------------

/**
 * ForEach：数组渲染。编译为 wx:for。
 * @param items 数据源数组
 * @param itemGenerator 循环体 UI 描述
 * @param keyGenerator 键生成函数，编译为 wx:key；缺失时编译期 warning 回退 index
 */
declare function ForEach<T>(
  items: readonly T[],
  itemGenerator: (item: T, index: number) => void,
  keyGenerator?: (item: T, index: number) => string,
): void;

// ---------------------------------------------------------------------------
// 路由 API（06 篇"路由适配"）
// ---------------------------------------------------------------------------

interface ArkRouterPushOptions {
  /** 目标页面路由名（编译期由路由表映射为页面路径） */
  name: string;
  /** 路由参数，对象值由编译器统一编解码为 url query */
  param?: Record<string, unknown>;
  /** 回传数据回调（编译为 wx.navigateTo events + eventChannel） */
  onResult?: (result: unknown) => void;
}

interface ArkRouterNameOptions {
  name: string;
  param?: Record<string, unknown>;
}

/** ArkMP 路由命名空间（编译为 wx.navigateTo / wx.redirectTo / ... ） */
declare namespace router {
  /** 压栈跳转（wx.navigateTo） */
  function push(options: ArkRouterPushOptions): void;
  /** 替换当前页（wx.redirectTo） */
  function replace(options: ArkRouterNameOptions): void;
  /** 返回上一页（wx.navigateBack） */
  function back(): void;
  /** 返回并回传数据（eventChannel.emit） */
  function pop(result?: unknown): void;
  /** 切换 tab 页（wx.switchTab） */
  function switchTab(options: ArkRouterNameOptions): void;
  /** 重启到指定页（wx.reLaunch） */
  function relaunch(options: ArkRouterNameOptions): void;
}
