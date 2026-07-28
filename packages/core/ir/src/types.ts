/**
 * ArkMP 中间表示（IR）类型定义，见 docs/arkui-miniprogram/02-pipeline.md ②③。
 *
 * IR 与两端语法解耦：不引用任何 `ts.Node`，所有表达式已序列化为
 * 目标无关的描述（static / binding）。本包保持零依赖（不引用 `typescript`）。
 */

/**
 * 表达式描述（02 篇③）：
 * - `static`：纯静态表达式，编译期可求值，如 `.fontSize(20)` 的 `20`
 * - `binding`：依赖状态的表达式，进 WXML `{{}}` 绑定，
 *   如 `` `count=${this.count}` `` → `{ kind: 'binding', path: 'count', template: 'count=${0}' }`
 * - `object`：含绑定字段的对象字面量（自定义组件 props），
 *   如 `{ status: this.status, label: 'OK' }` → 逐属性分类，保留 key 结构。
 * - `method-call`：build() 中的 `this.method(args)` 调用（纯函数方法），
 *   编译为 WXS 函数，在 WXML 中通过 `{{__wxs.method(args)}}` 调用。
 */
export type Expression = StaticExpression | BindingExpression | ObjectExpression | MethodCallExpression;

export interface StaticExpression {
  kind: 'static';
  /** 编译期已求值的字面量 */
  value: unknown;
}

export interface BindingExpression {
  kind: 'binding';
  /** 首要状态路径（向后兼容），如 'count'、'form.id' */
  path: string;
  /** 模板字符串，用 `${0}`、`${1}`... 占位各路径求值结果；纯路径绑定可省略 */
  template?: string;
  /** 全部绑定路径（template 含 `${1}` 及以上占位时必需）；单路径时可省略 */
  paths?: string[];
  /**
   * 整体表达式绑定（三元、算术等）：为 true 时整个 template 包在一个 `{{}}` 中，
   * `${i}` 替换为裸路径名（不套 `{{}}`），如 `${0} + 1` → `{{count + 1}}`。
   * 模板字符串插值（`` `count=${this.count}` ``）为 false，`${0}` → `{{count}}`。
   */
  fullExpression?: boolean;
}

/**
 * 含绑定字段的对象字面量（自定义组件构造参数）。
 * 当对象字面量无法整体静态求值时，逐属性分类以保留 key→value 结构，
 * 供 transform-wxml 拆分为逐属性 WXML 绑定（如 `status="{{status}}"`）。
 */
export interface ObjectExpression {
  kind: 'object';
  /** 属性名 → 分类后的表达式 */
  properties: Record<string, Expression>;
}

/**
 * 方法调用表达式（build() 中的 `this.method(args)`）。
 * 仅当方法满足 WXS 纯函数约束（不引用 this、ES5 子集）时产生，
 * transform-wxml 将其编译为 `{{__wxs.method(args)}}` 并在 WXML 头部注入 `<wxs>` 块。
 */
export interface MethodCallExpression {
  kind: 'method-call';
  /** 方法名，如 'pointLabel' */
  method: string;
  /** 参数表达式（每个参数本身也是 Expression） */
  args: Expression[];
}

/** 链式样式调用，如 `.fontSize(20)` → `{ name: 'fontSize', args: [static 20] }` */
export interface StyleCall {
  name: string;
  args: Expression[];
}

/**
 * 链式事件调用，如 `.onClick(() => { this.submit(); })`。
 * `body` 为回调体源码文本（analyze 阶段已序列化，与 ts AST 解耦），
 * 事件名由所在节点 id 派生（如 `__n7_click`），见 02 篇④。
 */
export interface EventCall {
  name: string;
  body: string;
}

/** 普通 UI 节点（组件调用 + 链式调用 + 子节点）。 */
export interface UINode {
  type: 'component';
  /** 稳定节点 id（`n0`, `n1`…），由 assignNodeIds 分配 */
  id?: string;
  /** 组件名：'Column' | 'Text' | 'Button' | ... */
  component: string;
  /** 构造参数，如 `{ space: 12 }`、`'文本'` */
  params: Expression[];
  children: UIChildNode[];
  styleCalls: StyleCall[];
  eventCalls: EventCall[];
}

/** `if/else` 控制节点，模板阶段翻译为 `wx:if` / `wx:else`。 */
export interface IfNode {
  type: 'if';
  id?: string;
  condition: Expression;
  children: UIChildNode[];
  /** else 分支；else-if 链表示为本数组中嵌套的 IfNode */
  elseChildren: UIChildNode[];
}

/** `ForEach` 控制节点，模板阶段翻译为 `wx:for`。 */
export interface ForEachNode {
  type: 'foreach';
  id?: string;
  /** 被遍历的数组表达式 */
  items: Expression;
  /** 迭代变量名（→ `wx:for-item`） */
  itemName: string;
  /** 下标变量名（→ `wx:for-index`），可省略 */
  indexName?: string;
  /**
   * 键生成信息（→ `wx:key`）。
   * - 字符串：属性名，生成 `wx:key="attrName"`
   * - '*this'：以 item 自身作为 key，生成 `wx:key="*this"`
   * - undefined：未提供键函数，回退 `wx:key="index"` 并发 W3002
   */
  keyField?: string;
  /** 源码位置（预处理后 AST 坐标，pipeline 用 positionMap 回溯到原始 .ets） */
  loc?: { line: number; column: number };
  children: UIChildNode[];
}

/** UI 树子节点：普通组件节点或控制节点。 */
export type UIChildNode = UINode | IfNode | ForEachNode;

/** `@State` 字段。 */
export interface StateField {
  name: string;
  /** 序列化后的类型文本，如 'number'、'string[]' */
  type: string;
  /** 初始值（编译期静态表达式） */
  initialValue?: Expression;
  /** `@Watch` 回调方法名（`@Watch('onCountChange')`） */
  watch?: string;
}

/** `@Prop` / `@Link` / 普通成员字段。 */
export interface PropField {
  name: string;
  type: string;
  kind: 'prop' | 'link' | 'plain';
  initialValue?: Expression;
}

/**
 * 生命周期钩子，值为方法体源码文本（已序列化）。
 * 存在对应字段即表示组件声明了该钩子。
 * 映射表见 05 篇「生命周期映射」（onDidBuild → onReady/ready）。
 *
 * ArkMP 同时支持 ArkUI 命名（推荐）与小程序原生命名，两者无重名冲突。
 * 原生命名钩子（onLoad/onShow/attached 等）经 analyzer 归入 model.methods，
 * 由 runtime 透传/映射到对应的小程序钩子，不在本接口中声明。
 */
export interface LifecycleHooks {
  aboutToAppear?: string;
  aboutToDisappear?: string;
  onPageShow?: string;
  onPageHide?: string;
  onDidBuild?: string;
  onPullRefresh?: string;
}

/** 普通方法（事件处理等），params/body 均已序列化。 */
export interface MethodDecl {
  name: string;
  params: string[];
  body: string;
}

/** 可提取为 WXS 的纯函数方法（不引用 this、ES5 子集）。 */
export interface WxsMethodDecl {
  name: string;
  params: string[];
  body: string;
}

/**
 * 组件模型：编译器核心 IR（02 篇②）。
 * 一个 `.ets` 文件中每个 `struct` 组件对应一个 ComponentModel。
 */
export interface ComponentModel {
  /** struct 名 */
  name: string;
  /** 是否有 `@Entry` 标记（页面） */
  isEntry: boolean;
  /**
   * `@Entry({...})` 的静态配置参数（如 `{ title: '首页', pullRefresh: true }`），
   * 仅页面组件存在；字段映射为页面 json 见 05 篇「页面行为配置」与 02 篇⑤。
   */
  entryOptions?: Record<string, unknown>;
  states: StateField[];
  props: PropField[];
  lifecycle: LifecycleHooks;
  methods: MethodDecl[];
  /** WXS 纯函数方法（build() 绑定中可调用，编译为 `<wxs>` 模块） */
  wxsMethods: WxsMethodDecl[];
  /** `build()` 的 UI 结构树 */
  buildTree: UINode;
  /** `@Builder` 方法：方法名 → UI 结构树 */
  builders: Record<string, UINode>;
}
