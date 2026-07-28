/**
 * buildTree → WXML（docs/arkui-miniprogram/03-component-mapping.md 的可执行形式）。
 *
 * 覆盖 03 篇规则：
 * - 组件节点 → 小程序标签 + runtime 基础 class（消费 @arkmp/mapping-components）；
 * - 构造参数 → 标签属性 / 文本内容 / gap 样式；
 * - 事件调用 → `bindtap="__n7_click"` 形式，事件名由节点 id 派生；
 * - if/else → `wx:if` / `wx:elif` / `wx:else`（`<block>` 包裹）；
 * - ForEach → `wx:for`（含 `wx:key`、`wx:for-item` / `wx:for-index` 命名）；
 * - binding 表达式 → `{{}}` 插值（模板字符串按 path 序列化）；
 * - 自定义组件 → kebab-case 标签 + 属性绑定；
 * - 可选 classMap / inlineStyles（transform-wxss 的产物）→ 合并进节点的
 *   `class` / `style` 属性（baseClass 在前、静态 style 声明在前）；
 * - 不支持的组件 → error 诊断（E3xxx 码段），产物中保留注释占位。
 *
 * 输出为带缩进的可读字符串；最终排版（空行、头注释等）由 emitter 统一处理。
 */

import { errorDiagnostic, warningDiagnostic } from '@arkmp/diagnostics';
import type { Diagnostic } from '@arkmp/diagnostics';
import type { Expression, UIChildNode, UINode, WxsMethodDecl } from '@arkmp/ir';
import { getComponentMapping, resolveEventMapping } from '@arkmp/mapping-components';
import type { ComponentMapping } from '@arkmp/mapping-components';

/** transform-wxml 诊断码（E3xxx 码段，02 篇诊断格式）。 */
export const WXML_DIAGNOSTIC_CODES = {
  /** 不支持的组件 */
  UNSUPPORTED_COMPONENT: 'E3001',
  /** 未收录的事件调用，已跳过 */
  UNKNOWN_EVENT: 'W3001',
  /** ForEach 缺少 key 信息，回退 wx:key="index" */
  FOREACH_KEY_FALLBACK: 'W3002',
  /** 节点缺少稳定 id，事件名/属性降级为匿名计数 */
  MISSING_NODE_ID: 'W3003',
} as const;

export interface TransformWxmlOptions {
  /** 缩进字符串，默认两个空格 */
  indent?: string;
  /**
   * nodeId → WXSS 类名（来自 transform-wxss 的 classMap），
   * 与映射表 baseClass 合并进节点的 `class` 属性（baseClass 在前）。
   */
  classMap?: Record<string, string>;
  /**
   * nodeId → 内联样式文本（来自 transform-wxss 的 inlineStyles，动态样式），
   * 追加进节点的 `style` 属性（静态声明在前）。
   */
  inlineStyles?: Record<string, string>;
  /** WXS 纯函数方法表（注入为 WXML 头部 `<wxs>` 块） */
  wxsMethods?: WxsMethodDecl[];
}

export interface TransformWxmlResult {
  wxml: string;
  diagnostics: Diagnostic[];
}

/**
 * 把 `build()` 的 UI 结构树翻译为 WXML 字符串。
 * 不支持的组件产生 error 级诊断（调用方应据此阻断构建）。
 */
export function transformWxml(
  buildTree: UINode,
  options: TransformWxmlOptions = {},
): TransformWxmlResult {
  const renderer = new WxmlRenderer(
    options.indent ?? '  ',
    options.classMap ?? {},
    options.inlineStyles ?? {},
  );
  renderer.renderComponent(buildTree, 0);
  const body = renderer.lines.join('\n') + '\n';
  const wxsBlock =
    options.wxsMethods && options.wxsMethods.length > 0
      ? buildWxsBlock(options.wxsMethods) + '\n'
      : '';
  const wxml = wxsBlock ? wxsBlock + body : body;
  return { wxml, diagnostics: renderer.diagnostics };
}

/** 将 WXS 方法表序列化为 `<wxs module="__wxs">` 块。 */
function buildWxsBlock(methods: WxsMethodDecl[]): string {
  const fns = methods.map((m) => {
    const body = m.body
      .split('\n')
      .map((line) => `    ${line}`)
      .join('\n');
    return `  ${m.name}: function(${m.params.join(', ')}) {\n${body}\n  }`;
  });
  return `<wxs module="__wxs">\nmodule.exports = {\n${fns.join(',\n')}\n};\n</wxs>`;
}

class WxmlRenderer {
  readonly lines: string[] = [];
  readonly diagnostics: Diagnostic[] = [];
  private anonCounter = 0;
  /** ForEach 循环变量栈（外层到内层），供 eventAttrs 生成 data-* 属性 */
  private loopVars: string[] = [];

  constructor(
    private readonly indent: string,
    private readonly classMap: Record<string, string>,
    private readonly inlineStyles: Record<string, string>,
  ) {}

  private pad(depth: number): string {
    return this.indent.repeat(depth);
  }

  /** 合并映射表 baseClass 与 transform-wxss 的类名（去重，baseClass 在前）。 */
  private mergedClass(baseClass: string | undefined, id: string): string | undefined {
    const parts = [baseClass, this.classMap[id]].filter(
      (c): c is string => c !== undefined && c !== '',
    );
    return parts.length === 0 ? undefined : [...new Set(parts)].join(' ');
  }

  /** 合并静态 style 声明与 transform-wxss 的动态内联样式（静态在前）。 */
  private mergedStyle(styleDecls: string[], id: string): string | undefined {
    const inline = this.inlineStyles[id];
    const all = inline !== undefined && inline !== '' ? [...styleDecls, inline] : styleDecls;
    return all.length === 0 ? undefined : all.join('; ');
  }

  /** 节点稳定 id；缺失时降级为匿名计数并 warning（03 篇要求 id 稳定可 diff）。 */
  private nodeId(node: UIChildNode): string {
    if (node.id !== undefined) return node.id;
    this.diagnostics.push(
      warningDiagnostic(
        WXML_DIAGNOSTIC_CODES.MISSING_NODE_ID,
        '节点缺少稳定 id（应先经 assignNodeIds 分配），事件名降级为匿名计数',
      ),
    );
    return `anon${this.anonCounter++}`;
  }

  renderNode(node: UIChildNode, depth: number): void {
    switch (node.type) {
      case 'component':
        this.renderComponent(node, depth);
        return;
      case 'if':
        this.renderIf(node, depth);
        return;
      case 'foreach':
        this.renderForEach(node, depth);
        return;
    }
  }

  renderChildren(children: UIChildNode[], depth: number): void {
    for (const child of children) {
      this.renderNode(child, depth);
    }
  }

  // ── 组件节点 ──

  renderComponent(node: UINode, depth: number): void {
    const mapping = getComponentMapping(node.component);

    if (mapping?.support === 'unsupported') {
      this.diagnostics.push(
        errorDiagnostic(
          WXML_DIAGNOSTIC_CODES.UNSUPPORTED_COMPONENT,
          `不支持的组件：${node.component}`,
          { help: mapping.alternative ?? '见 docs/arkui-miniprogram/08-limitations.md' },
        ),
      );
      this.lines.push(`${this.pad(depth)}<!-- arkmp: unsupported ${node.component} -->`);
      return;
    }

    if (mapping !== undefined) {
      this.renderMappedComponent(node, mapping, depth);
      return;
    }

    if (/^[A-Z]/.test(node.component)) {
      this.renderCustomComponent(node, depth);
      return;
    }

    this.diagnostics.push(
      errorDiagnostic(
        WXML_DIAGNOSTIC_CODES.UNSUPPORTED_COMPONENT,
        `未收录的组件：${node.component}`,
        { help: '见 docs/arkui-miniprogram/03-component-mapping.md 组件映射表' },
      ),
    );
    this.lines.push(`${this.pad(depth)}<!-- arkmp: unknown ${node.component} -->`);
  }

  private renderMappedComponent(node: UINode, mapping: ComponentMapping, depth: number): void {
    const tag = mapping.tag ?? 'view';
    const id = this.nodeId(node);
    const attrs: string[] = [];

    const classValue = this.mergedClass(mapping.baseClass, id);
    if (classValue !== undefined) {
      attrs.push(attr('class', classValue));
    }
    for (const [name, value] of Object.entries(mapping.tagAttributes ?? {})) {
      attrs.push(attr(name, value));
    }

    // 构造参数 → 属性 / 文本 / gap 样式
    let textContent: Expression | undefined;
    const styleDecls: string[] = [];
    for (const rule of mapping.params ?? []) {
      const expr = pickParam(node, rule.arg);
      if (expr === undefined) continue;
      switch (rule.target) {
        case 'text':
          textContent = expr;
          break;
        case 'attribute':
          attrs.push(attr(rule.name ?? String(rule.arg), expressionText(expr)));
          break;
        case 'style':
          if (expr.kind === 'static' && typeof expr.value === 'number') {
            // 长度样式参数（如 space → gap）：vp→rpx 默认系数 ×2（04 篇）
            styleDecls.push(`${rule.name ?? 'gap'}: ${expr.value * 2}rpx`);
          } else {
            styleDecls.push(`${rule.name ?? 'gap'}: ${expressionText(expr)}`);
          }
          break;
      }
    }

    // 链式调用 → 标签属性（如 Image.objectFit → mode）
    for (const rule of mapping.styleAttributes ?? []) {
      const call = node.styleCalls.find((c) => c.name === rule.name);
      const arg = call?.args[0];
      if (arg === undefined) continue;
      if (arg.kind === 'binding' || arg.kind === 'object') {
        attrs.push(attr(rule.attribute, expressionText(arg)));
      } else {
        const raw = String(arg.value);
        const tail = raw.includes('.') ? raw.slice(raw.lastIndexOf('.') + 1) : raw;
        attrs.push(attr(rule.attribute, rule.enumMap?.[tail] ?? raw));
      }
    }

    // canvas-id 自动分配（03 篇「Canvas」）
    if (tag === 'canvas') {
      attrs.push(attr('canvas-id', `canvas-${id}`));
    }

    // 事件调用 → bind 属性
    attrs.push(...this.eventAttrs(node, mapping, id));

    const styleValue = this.mergedStyle(styleDecls, id);
    if (styleValue !== undefined) {
      attrs.push(attr('style', styleValue));
    }

    this.emitElement(depth, tag, attrs, node.children, textContent);
  }

  /** 自定义组件引用（03 篇）：kebab-case 标签；静态字符串属性直接写字面量，其余一律包 {{}}。 */
  private renderCustomComponent(node: UINode, depth: number): void {
    const tag = kebabCase(node.component);
    const id = this.nodeId(node);
    const attrs: string[] = [];
    const classValue = this.mergedClass(undefined, id);
    if (classValue !== undefined) {
      attrs.push(attr('class', classValue));
    }
    const first = node.params[0];
    if (first !== undefined) {
      if (first.kind === 'object') {
        for (const [key, value] of Object.entries(first.properties)) {
          attrs.push(attr(key, expressionText(value)));
        }
      } else if (first.kind === 'static' && isPlainObject(first.value)) {
        for (const [key, value] of Object.entries(first.value)) {
          attrs.push(
            typeof value === 'string' ? attr(key, value) : attr(key, `{{${String(value)}}}`),
          );
        }
      } else {
        attrs.push(attr('value', expressionText(first)));
      }
    }
    attrs.push(...this.eventAttrs(node, undefined, id));
    const styleValue = this.mergedStyle([], id);
    if (styleValue !== undefined) {
      attrs.push(attr('style', styleValue));
    }
    this.emitElement(depth, tag, attrs, node.children, undefined);
  }

  /** 事件调用 → `bindtap="__n7_click"` 属性列表；未收录事件 warning 并跳过。 */
  private eventAttrs(node: UINode, mapping: ComponentMapping | undefined, id: string): string[] {
    const attrs: string[] = [];
    // ForEach 循环变量 → data-* 属性（事件回调通过 e.currentTarget.dataset 读取）
    if (node.eventCalls.length > 0 && this.loopVars.length > 0) {
      for (const v of this.loopVars) {
        attrs.push(attr(`data-${v}`, `{{${v}}}`));
      }
    }
    for (const call of node.eventCalls) {
      const event = resolveEventMapping(mapping, call.name);
      if (event === undefined) {
        this.diagnostics.push(
          warningDiagnostic(
            WXML_DIAGNOSTIC_CODES.UNKNOWN_EVENT,
            `未收录的事件调用：.${call.name}(...)（组件 ${node.component}），已跳过`,
          ),
        );
        continue;
      }
      const handler = `__${id}_${event.suffix}`;
      if (call.name === 'onTouch') {
        // 03 篇：onTouch → bindtouchstart/move/end 分发
        for (const phase of ['bindtouchstart', 'bindtouchmove', 'bindtouchend']) {
          attrs.push(attr(phase, handler));
        }
      } else {
        attrs.push(attr(event.bind, handler));
      }
    }
    return attrs;
  }

  /** 输出一个元素：有子节点/文本时成对标签，否则自闭合。 */
  private emitElement(
    depth: number,
    tag: string,
    attrs: string[],
    children: UIChildNode[],
    textContent: Expression | undefined,
  ): void {
    const open = `${this.pad(depth)}<${tag}${attrs.length > 0 ? ' ' + attrs.join(' ') : ''}`;
    const text = textContent === undefined ? '' : escapeText(expressionText(textContent));

    if (children.length === 0 && text === '') {
      this.lines.push(`${open} />`);
      return;
    }
    if (children.length === 0) {
      this.lines.push(`${open}>${text}</${tag}>`);
      return;
    }
    this.lines.push(`${open}>`);
    if (text !== '') {
      this.lines.push(`${this.pad(depth + 1)}${text}`);
    }
    this.renderChildren(children, depth + 1);
    this.lines.push(`${this.pad(depth)}</${tag}>`);
  }

  // ── if / else → wx:if（03 篇「控制流翻译」） ──

  private renderIf(node: Extract<UIChildNode, { type: 'if' }>, depth: number): void {
    this.lines.push(`${this.pad(depth)}<block wx:if="${expressionText(node.condition)}">`);
    this.renderChildren(node.children, depth + 1);
    this.lines.push(`${this.pad(depth)}</block>`);
    this.renderElseBranch(node.elseChildren, depth);
  }

  private renderElseBranch(elseChildren: UIChildNode[], depth: number): void {
    if (elseChildren.length === 0) return;
    // else-if 链：else 分支中嵌套的单个 IfNode
    const only = elseChildren.length === 1 ? elseChildren[0] : undefined;
    if (only?.type === 'if') {
      this.lines.push(`${this.pad(depth)}<block wx:elif="${expressionText(only.condition)}">`);
      this.renderChildren(only.children, depth + 1);
      this.lines.push(`${this.pad(depth)}</block>`);
      this.renderElseBranch(only.elseChildren, depth);
      return;
    }
    this.lines.push(`${this.pad(depth)}<block wx:else>`);
    this.renderChildren(elseChildren, depth + 1);
    this.lines.push(`${this.pad(depth)}</block>`);
  }

  // ── ForEach → wx:for（03 篇「控制流翻译」） ──

  private renderForEach(node: Extract<UIChildNode, { type: 'foreach' }>, depth: number): void {
    const attrs = [
      attr('wx:for', expressionText(node.items)),
      attr('wx:for-item', node.itemName),
    ];
    if (node.indexName !== undefined) {
      attrs.push(attr('wx:for-index', node.indexName));
    }
    if (node.keyField !== undefined) {
      // 键生成函数提供了属性名或 *this
      attrs.push(attr('wx:key', node.keyField));
    } else {
      // 缺少键生成函数，回退 index 并发 W3002
      attrs.push(attr('wx:key', 'index'));
      this.diagnostics.push(
        warningDiagnostic(
          WXML_DIAGNOSTIC_CODES.FOREACH_KEY_FALLBACK,
          'ForEach 缺少键生成函数信息，回退 wx:key="index"',
          {
            line: node.loc?.line,
            column: node.loc?.column,
            help: '见 docs/arkui-miniprogram/03-component-mapping.md「ForEach → wx:for」',
          },
        ),
      );
    }
    this.lines.push(`${this.pad(depth)}<block ${attrs.join(' ')}>`);
    // 进入 ForEach 作用域：item + index 变量对子树内的事件回调可见
    const savedLen = this.loopVars.length;
    this.loopVars.push(node.itemName);
    if (node.indexName !== undefined) this.loopVars.push(node.indexName);
    this.renderChildren(node.children, depth + 1);
    this.loopVars.length = savedLen;
    this.lines.push(`${this.pad(depth)}</block>`);
  }
}

// ── 工具函数 ──

/** 取构造参数：数字下标取位置参数；字符串键取首个对象参数中的字段。 */
function pickParam(node: UINode, arg: number | string): Expression | undefined {
  if (typeof arg === 'number') return node.params[arg];
  const first = node.params[0];
  if (first?.kind === 'static' && isPlainObject(first.value) && arg in first.value) {
    return { kind: 'static', value: first.value[arg] };
  }
  if (first?.kind === 'object' && arg in first.properties) {
    return first.properties[arg];
  }
  return undefined;
}

/**
 * 表达式 → WXML 文本（03 篇「状态绑定表达式」）。
 * - static：字面量原样输出；
 * - binding：纯路径 → `{{path}}`；带模板 → `${0}` 占位替换为 `{{path}}`；
 * - object：不应在文本/属性值上下文出现（仅用于组件 params 拆分），降级为 JSON 文本；
 * - method-call：`{{__wxs.method(arg)}}`，参数去除外层 `{{}}`。
 */
export function expressionText(expr: Expression): string {
  if (expr.kind === 'static') {
    return String(expr.value);
  }
  if (expr.kind === 'object') {
    return JSON.stringify(expr.properties);
  }
  if (expr.kind === 'method-call') {
    const args = expr.args.map((a) => stripMustache(expressionText(a)));
    return `{{__wxs.${expr.method}(${args.join(', ')})}}`;
  }
  if (expr.template === undefined) {
    return `{{${expr.path}}}`;
  }
  // 整体表达式：`{{path + 1}}`、`{{a + b}}`、`{{cond ? 'x' : 'y'}}`
  if (expr.fullExpression) {
    let result = expr.template;
    if (expr.paths && expr.paths.length > 0) {
      for (let i = 0; i < expr.paths.length; i++) {
        result = result.split(`\${${i}}`).join(expr.paths[i]);
      }
    } else {
      result = result.split('${0}').join(expr.path);
    }
    return `{{${result}}}`;
  }
  // 模板字符串插值：`count={{count}}`、`{{a}} + {{b}}`
  if (expr.paths && expr.paths.length > 0) {
    let result = expr.template;
    for (let i = 0; i < expr.paths.length; i++) {
      result = result.split(`\${${i}}`).join(`{{${expr.paths[i]}}}`);
    }
    return result;
  }
  return expr.template.split('${0}').join(`{{${expr.path}}}`);
}

/** `{{count}}` → `count`（WXS 调用参数去除外层 `{{}}`）。 */
function stripMustache(text: string): string {
  const m = text.match(/^\{\{(.+)\}\}$/);
  return m ? m[1] : text;
}

/** WXML 属性：`name="value"`（值做属性转义）。 */
function attr(name: string, value: string): string {
  return `${name}="${value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')}"`;
}

/** 文本内容转义。 */
function escapeText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
}

/** UpperCamel → kebab-case（`UserCard` → `user-card`）。 */
function kebabCase(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
