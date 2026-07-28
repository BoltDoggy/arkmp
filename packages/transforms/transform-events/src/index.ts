/**
 * @arkmp/transform-events —— L2 事件转换链（02 篇④第四条链）。
 *
 * 输入 ComponentModel（IR），输出两部分：
 * - `bindings`：事件表，供 transform-wxml 生成 `bindtap="__n7_click"` 等绑定属性；
 * - `methods`：事件回调体抽取出的方法（方法名 → 回调体源码文本）。
 *
 * ## 事件名派生协议（与 transform-wxml 的衔接）
 *
 * 方法名由节点 id 派生：`__{nodeId}_{短事件名}`，如 `n7` 节点上的
 * `onClick` → `__n7_click`。短事件名为 ArkUI 事件名去掉 `on` 前缀、
 * 首字母小写（`onClick` → `click`，`onReachEnd` → `reachEnd`）。
 * 节点 id 缺省时按先序遍历顺序分配确定性回退 id（`x0`, `x1`…），
 * 保证同一 model 多次转换结果完全一致。
 *
 * 节点 id → 小程序绑定属性（bindtap / bindchange / ...）的映射属于
 * 组件映射表职责（03 篇），本包只提供 `event`（ArkUI 事件名）与
 * `name`（短名），由 transform-wxml 查表决定绑定属性名。
 *
 * ## 与 transform-js 的方法合并协议
 *
 * 本包只做"抽取"，**不做赋值改写**：`methods` 中的回调体为原始源码文本。
 * 回调体内的 `this.xxx = ...` 状态赋值改写（05 篇，02 篇④"由 ⑤ 阶段的
 * 赋值改写器处理"）由 transform-js 统一执行——调用方应把
 * `transformEvents(model).methods` 作为 `transformJs(model, { eventMethods })`
 * 的 `eventMethods` 传入，transform-js 对所有方法体（声明方法 + 事件方法）
 * 应用同一套赋值改写后并入 `createPage`/`createComponent` 的 `methods`。
 * 这样改写逻辑只有一份，事件方法与声明方法行为一致。
 *
 * ## ForEach 作用域传递
 *
 * ForEach 循环体内的事件回调引用循环变量（如 `(r) => { Row().onClick(() =>
 * this.go(r.id)) }` 中的 `r`），但回调体被抽取为顶层方法后该变量不在作用域内。
 * 本包遍历时追踪 ForEach 作用域，将循环变量名（item + index）记入
 * `EventMethod.loopVars`。transform-js 据此给方法加 `e` 参数并将变量引用改写为
 * `e.currentTarget.dataset.<name>`，transform-wxml 据此在元素上补
 * `data-<name>="{{<name>}}"` 属性——两端协同恢复循环变量的运行时绑定。
 */

import type { ComponentModel, UIChildNode, UINode } from '@arkmp/ir';

/** 单个事件绑定（事件表的一行）。 */
export interface EventBinding {
  /** 节点 id（如 `n7`；缺省 id 时为确定性回退 id `x0`…） */
  nodeId: string;
  /** ArkUI 事件名，如 `onClick` */
  event: string;
  /** 短事件名（去 `on` 前缀、首字母小写），如 `click` */
  name: string;
  /** 派生的方法名，如 `__n7_click`；wxml 侧据此生成 bind 属性值 */
  method: string;
}

/** 抽取出的事件方法（方法名 → 回调体 + 循环变量作用域）。 */
export interface EventMethod {
  /** 回调体源码文本（未改写，见头部合并协议） */
  body: string;
  /**
   * 回调所处的 ForEach 循环变量名列表（外层到内层，含 item 与 index）。
   * 非空时 transform-js 会给方法加 `e` 参数并将变量引用改写为
   * `e.currentTarget.dataset.<name>`，transform-wxml 会补 `data-*` 属性。
   */
  loopVars?: string[];
}

export interface TransformEventsResult {
  /** 事件表：先序遍历顺序，节点内按 eventCalls 声明顺序 */
  bindings: EventBinding[];
  /** 抽取的事件方法：方法名 → EventMethod（见头部合并协议） */
  methods: Record<string, EventMethod>;
}

/** `onClick` → `click`；非 `on` 前缀的事件名原样返回。 */
export function shortEventName(event: string): string {
  if (event.length > 2 && event.startsWith('on') && event[2] >= 'A' && event[2] <= 'Z') {
    return event[2].toLowerCase() + event.slice(3);
  }
  return event;
}

/** 由节点 id 与事件名派生方法名：`n7` + `onClick` → `__n7_click`。 */
export function deriveMethodName(nodeId: string, event: string): string {
  return `__${nodeId}_${shortEventName(event)}`;
}

/**
 * 事件转换（02 篇④）：遍历 buildTree 与全部 @Builder 树，
 * 收集 eventCalls → 事件表 + 方法表。纯函数，同一 model 结果稳定。
 */
export function transformEvents(model: ComponentModel): TransformEventsResult {
  const bindings: EventBinding[] = [];
  const methods: Record<string, EventMethod> = {};
  let fallbackCounter = 0;

  const visitNode = (node: UINode, loopVars: string[]): void => {
    const nodeId = node.id ?? `x${fallbackCounter++}`;
    for (const call of node.eventCalls) {
      const method = deriveMethodName(nodeId, call.name);
      bindings.push({ nodeId, event: call.name, name: shortEventName(call.name), method });
      methods[method] =
        loopVars.length > 0 ? { body: call.body, loopVars } : { body: call.body };
    }
    for (const child of node.children) visitChild(child, loopVars);
  };

  const visitChild = (child: UIChildNode, loopVars: string[]): void => {
    switch (child.type) {
      case 'component':
        visitNode(child, loopVars);
        break;
      case 'if':
        for (const c of child.children) visitChild(c, loopVars);
        for (const c of child.elseChildren) visitChild(c, loopVars);
        break;
      case 'foreach': {
        // 进入 ForEach 作用域：item + index（若有）对子树内的事件回调可见
        const scoped = [...loopVars, child.itemName];
        if (child.indexName !== undefined) scoped.push(child.indexName);
        for (const c of child.children) visitChild(c, scoped);
        break;
      }
    }
  };

  visitNode(model.buildTree, []);
  for (const builderName of Object.keys(model.builders)) {
    visitNode(model.builders[builderName], []);
  }

  return { bindings, methods };
}
