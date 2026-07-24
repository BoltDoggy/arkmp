/**
 * styleCalls → WXSS 类 + 内联兜底（docs/arkui-miniprogram/04-style-mapping.md 的可执行形式）。
 *
 * 总体策略（04 篇）：
 * - 静态样式（编译期可求值）→ 提取为 WXSS 类，类名由节点 id 派生（`arkmp-n1`，
 *   可通过 classPrefix 配置），相同样式组合去重为一个类；
 * - 动态样式（binding）→ 内联 style 表（`inlineStyles[nodeId]`），由 WXML 侧
 *   以 `style="{{...}}"` 形式拼接；
 * - 白名单外修饰符 → warning + 类体内注释 `/* arkmp: unsupported .blur(10) *​/`，
 *   不阻断构建。
 */

import { warningDiagnostic } from '@arkmp/diagnostics';
import type { Diagnostic } from '@arkmp/diagnostics';
import type { Expression, StyleCall, UIChildNode, UINode } from '@arkmp/ir';
import {
  DEFAULT_UNIT_RATIO,
  convertUnit,
  getStyleMapping,
  resolveEnum,
} from '@arkmp/mapping-styles';
import type { StyleMappingEntry } from '@arkmp/mapping-styles';

/** transform-wxss 诊断码（W31xx 码段，均为 warning，不阻断构建）。 */
export const WXSS_DIAGNOSTIC_CODES = {
  /** 白名单外修饰符，生成注释兜底 */
  UNSUPPORTED_MODIFIER: 'W3101',
  /** 枚举值未命中映射 */
  UNKNOWN_ENUM_VALUE: 'W3102',
  /** visibility(None) 建议改写为条件渲染 */
  VISIBILITY_NONE: 'W3103',
  /** layoutWeight 父容器非 Row/Column */
  LAYOUT_WEIGHT_PARENT: 'W3104',
  /** 特殊修饰符的动态（binding）形式暂不支持内联，已跳过 */
  DYNAMIC_SPECIAL: 'W3105',
  /** 节点缺少稳定 id，类名降级为匿名计数 */
  MISSING_NODE_ID: 'W3106',
} as const;

export interface TransformWxssOptions {
  /** vp→rpx 换算系数，默认 2（04 篇「单位换算」） */
  unitRatio?: number;
  /** 类名前缀，默认 'arkmp-'（类名形如 `arkmp-n1`） */
  classPrefix?: string;
}

export interface TransformWxssResult {
  /** 页面 WXSS 文本（类按首次出现顺序输出） */
  wxss: string;
  /** nodeId → 内联 style 文本（动态样式，供 WXML `style="..."` 使用） */
  inlineStyles: Record<string, string>;
  /** nodeId → WXSS 类名（含去重复用；供 WXML/emitter 拼 class 使用） */
  classMap: Record<string, string>;
  diagnostics: Diagnostic[];
}

/** 把 `build()` 的 UI 结构树中的 styleCalls 翻译为 WXSS + 内联样式表。 */
export function transformWxss(
  buildTree: UINode,
  options: TransformWxssOptions = {},
): TransformWxssResult {
  const t = new WxssTransformer(
    options.unitRatio ?? DEFAULT_UNIT_RATIO,
    options.classPrefix ?? 'arkmp-',
  );
  t.walk(buildTree, undefined);
  return {
    wxss: t.renderWxss(),
    inlineStyles: t.inlineStyles,
    classMap: t.classMap,
    diagnostics: t.diagnostics,
  };
}

/** 单个节点样式处理中的中间产物。 */
interface NodeStyleAcc {
  /** 静态 CSS 声明（不含选择器） */
  decls: string[];
  /** 动态样式声明（进 inlineStyles） */
  inline: string[];
  /** 白名单外修饰符注释 */
  comments: string[];
  /** maxLines 静态值（与 textOverflow 组合用） */
  maxLines?: number;
  /** textOverflow 是否为 Ellipsis */
  ellipsis: boolean;
}

class WxssTransformer {
  readonly diagnostics: Diagnostic[] = [];
  readonly inlineStyles: Record<string, string> = {};
  readonly classMap: Record<string, string> = {};
  /** 样式组合 key → 类名（去重，04 篇「相同样式组合全工程去重为一个类」） */
  private readonly dedup = new Map<string, string>();
  /** 类名 → 类体（声明 + 注释），按首次出现顺序 */
  private readonly classes = new Map<string, { decls: string[]; comments: string[] }>();
  private anonCounter = 0;

  constructor(
    private readonly unitRatio: number,
    private readonly classPrefix: string,
  ) {}

  private nodeId(node: UINode): string {
    if (node.id !== undefined) return node.id;
    this.diagnostics.push(
      warningDiagnostic(
        WXSS_DIAGNOSTIC_CODES.MISSING_NODE_ID,
        '节点缺少稳定 id（应先经 assignNodeIds 分配），类名降级为匿名计数',
      ),
    );
    return `anon${this.anonCounter++}`;
  }

  walk(node: UIChildNode, parent: UINode | undefined): void {
    switch (node.type) {
      case 'component':
        this.processComponent(node, parent);
        for (const child of node.children) this.walk(child, node);
        return;
      case 'if':
        for (const child of node.children) this.walk(child, parent);
        for (const child of node.elseChildren) this.walk(child, parent);
        return;
      case 'foreach':
        for (const child of node.children) this.walk(child, parent);
        return;
    }
  }

  private processComponent(node: UINode, parent: UINode | undefined): void {
    if (node.styleCalls.length === 0) return;
    const id = this.nodeId(node);
    const acc: NodeStyleAcc = { decls: [], inline: [], comments: [], ellipsis: false };

    for (const call of node.styleCalls) {
      this.processCall(node, parent, call, acc);
    }
    this.combineTextClamp(acc);

    if (acc.inline.length > 0) {
      this.inlineStyles[id] = acc.inline.join('; ');
    }

    if (acc.decls.length === 0 && acc.comments.length === 0) return;
    // 去重：样式组合相同则复用首个类名
    const key = `${acc.decls.join('\n')}\n--\n${acc.comments.join('\n')}`;
    let className = this.dedup.get(key);
    if (className === undefined) {
      className = `${this.classPrefix}${id}`;
      this.dedup.set(key, className);
      this.classes.set(className, { decls: acc.decls, comments: acc.comments });
    }
    this.classMap[id] = className;
  }

  private processCall(
    node: UINode,
    parent: UINode | undefined,
    call: StyleCall,
    acc: NodeStyleAcc,
  ): void {
    const entry = getStyleMapping(call.name);
    if (entry === undefined) {
      // 04 篇：白名单外 → warning + 注释，不阻断构建
      this.diagnostics.push(
        warningDiagnostic(
          WXSS_DIAGNOSTIC_CODES.UNSUPPORTED_MODIFIER,
          `未列入白名单的修饰符：.${call.name}(${serializeArgs(call)})，已生成注释兜底`,
          { help: '见 docs/arkui-miniprogram/04-style-mapping.md 样式属性白名单' },
        ),
      );
      acc.comments.push(`/* arkmp: unsupported .${call.name}(${serializeArgs(call)}) */`);
      return;
    }

    // 动态样式（binding）→ 内联（04 篇「动态样式：留在 style="{{}}"」）
    const binding = call.args.find((a): a is Extract<Expression, { kind: 'binding' }> => a.kind === 'binding');
    if (binding !== undefined) {
      if (entry.css !== undefined) {
        acc.inline.push(`${entry.css}: ${bindingText(binding)}`);
      } else if (call.name !== 'objectFit') {
        this.diagnostics.push(
          warningDiagnostic(
            WXSS_DIAGNOSTIC_CODES.DYNAMIC_SPECIAL,
            `动态形式的特殊修饰符 .${call.name}() 暂不支持内联，已跳过`,
          ),
        );
      }
      return;
    }

    // objectFit 由 transform-wxml 转为 image mode 属性，不进 WXSS
    if (call.name === 'objectFit') return;

    const staticArgs = call.args
      .filter((a): a is Extract<Expression, { kind: 'static' }> => a.kind === 'static')
      .map((a) => a.value);

    switch (entry.value) {
      case 'length':
        acc.decls.push(`${entry.css}: ${this.length(staticArgs[0])}`);
        return;
      case 'color':
      case 'string':
        acc.decls.push(`${entry.css}: ${String(staticArgs[0])}`);
        return;
      case 'number':
        acc.decls.push(`${entry.css}: ${String(staticArgs[0])}`);
        return;
      case 'enum':
        this.processEnum(call, entry, staticArgs[0], acc);
        return;
      case 'special':
        this.processSpecial(node, parent, call, staticArgs, acc);
        return;
    }
  }

  private processEnum(
    call: StyleCall,
    entry: StyleMappingEntry,
    value: unknown,
    acc: NodeStyleAcc,
  ): void {
    // fontWeight 支持数值字面值（04 篇备注）
    if (call.name === 'fontWeight' && typeof value === 'number') {
      acc.decls.push(`${entry.css}: ${String(value)}`);
      return;
    }
    const raw = String(value);
    if (call.name === 'visibility' && (raw === 'None' || raw.endsWith('.None'))) {
      this.diagnostics.push(
        warningDiagnostic(
          WXSS_DIAGNOSTIC_CODES.VISIBILITY_NONE,
          '.visibility(None) 应改写为 if 条件渲染，已跳过',
          { help: '见 docs/arkui-miniprogram/04-style-mapping.md 白名单 visibility 条目' },
        ),
      );
      return;
    }
    const mapped = entry.enumMap !== undefined ? resolveEnum(entry.enumMap, raw) : undefined;
    if (mapped === undefined) {
      this.diagnostics.push(
        warningDiagnostic(
          WXSS_DIAGNOSTIC_CODES.UNKNOWN_ENUM_VALUE,
          `.${call.name}(${raw}) 枚举值未命中映射，已跳过`,
        ),
      );
      return;
    }
    acc.decls.push(`${entry.css}: ${mapped}`);
  }

  /** special 类修饰符的特判（04 篇各条目备注）。 */
  private processSpecial(
    node: UINode,
    parent: UINode | undefined,
    call: StyleCall,
    args: unknown[],
    acc: NodeStyleAcc,
  ): void {
    const first = args[0];
    switch (call.name) {
      case 'padding':
      case 'margin':
        acc.decls.push(`${call.name}: ${this.boxShorthand(first)}`);
        return;
      case 'constraintSize': {
        const obj = asObject(first);
        for (const [key, css] of [
          ['minWidth', 'min-width'],
          ['maxWidth', 'max-width'],
          ['minHeight', 'min-height'],
          ['maxHeight', 'max-height'],
        ] as const) {
          if (obj[key] !== undefined) acc.decls.push(`${css}: ${this.length(obj[key])}`);
        }
        return;
      }
      case 'backgroundImage':
        acc.decls.push(`background-image: url("${String(first)}")`);
        return;
      case 'border': {
        const obj = asObject(first);
        const width = this.length(obj['width'] ?? 1);
        const style = String(obj['style'] ?? 'solid');
        const color = String(obj['color'] ?? '#000');
        acc.decls.push(`border: ${width} ${style} ${color}`);
        if (obj['radius'] !== undefined) {
          acc.decls.push(`border-radius: ${this.length(obj['radius'])}`);
        }
        return;
      }
      case 'maxLines':
        acc.maxLines = typeof first === 'number' ? first : Number(first);
        return;
      case 'textOverflow':
        acc.ellipsis = String(first).endsWith('Ellipsis');
        return;
      case 'position': {
        const obj = asObject(first);
        acc.decls.push('position: absolute');
        if (obj['x'] !== undefined) acc.decls.push(`left: ${this.length(obj['x'])}`);
        if (obj['y'] !== undefined) acc.decls.push(`top: ${this.length(obj['y'])}`);
        return;
      }
      case 'offset': {
        const [x, y] = offsetArgs(args);
        acc.decls.push(`transform: translate(${this.length(x)}, ${this.length(y)})`);
        return;
      }
      case 'scale': {
        const obj = asObject(first);
        acc.decls.push(
          `transform: scale(${String(obj['x'] ?? first)}, ${String(obj['y'] ?? obj['x'] ?? first)})`,
        );
        return;
      }
      case 'rotate': {
        const obj = asObject(first);
        const angle = obj['angle'] ?? first;
        acc.decls.push(`transform: rotate(${String(angle)}deg)`);
        return;
      }
      case 'shadow': {
        const obj = asObject(first);
        const offsetX = this.length(obj['offsetX'] ?? 0);
        const offsetY = this.length(obj['offsetY'] ?? 0);
        const radius = this.length(obj['radius'] ?? 0);
        const color = String(obj['color'] ?? '#000');
        acc.decls.push(`box-shadow: ${offsetX} ${offsetY} ${radius} ${color}`);
        return;
      }
      case 'linearGradient': {
        const obj = asObject(first);
        const angle = Number(obj['angle'] ?? 180);
        const colors = Array.isArray(obj['colors']) ? obj['colors'] : [];
        const stops = colors
          .map((c: unknown) => {
            const pair = c as [unknown, unknown];
            return `${String(pair[0])} ${Number(pair[1]) * 100}%`;
          })
          .join(', ');
        acc.decls.push(`background: linear-gradient(${angle}deg, ${stops})`);
        return;
      }
      case 'aspectRatio':
        acc.decls.push(`aspect-ratio: ${String(first)}`);
        return;
      case 'layoutWeight':
        acc.decls.push(`flex: ${String(first)}`);
        if (parent?.component !== 'Row' && parent?.component !== 'Column') {
          this.diagnostics.push(
            warningDiagnostic(
              WXSS_DIAGNOSTIC_CODES.LAYOUT_WEIGHT_PARENT,
              `.layoutWeight(${String(first)}) 的父容器为 ${parent?.component ?? '未知'}（非 Row/Column），flex 可能不生效`,
              { help: '见 docs/arkui-miniprogram/04-style-mapping.md 白名单 layoutWeight 条目' },
            ),
          );
        }
        return;
      default:
        // 白名单标注 special 但此处未特判：按未知枚举处理，保守跳过
        this.diagnostics.push(
          warningDiagnostic(
            WXSS_DIAGNOSTIC_CODES.UNSUPPORTED_MODIFIER,
            `特殊修饰符 .${call.name}() 暂无换算实现，已跳过`,
          ),
        );
    }
  }

  /** maxLines + textOverflow(Ellipsis) 组合（04 篇：编译期按行数分流）。 */
  private combineTextClamp(acc: NodeStyleAcc): void {
    if (acc.maxLines !== undefined && acc.ellipsis) {
      if (acc.maxLines === 1) {
        acc.decls.push('overflow: hidden', 'white-space: nowrap', 'text-overflow: ellipsis');
      } else {
        acc.decls.push(
          'display: -webkit-box',
          '-webkit-box-orient: vertical',
          `-webkit-line-clamp: ${acc.maxLines}`,
          'overflow: hidden',
        );
      }
      return;
    }
    if (acc.maxLines === 1) {
      acc.decls.push('white-space: nowrap');
    } else if (acc.maxLines !== undefined) {
      acc.decls.push(`-webkit-line-clamp: ${acc.maxLines}`);
    }
    if (acc.ellipsis && acc.maxLines === undefined) {
      acc.decls.push('text-overflow: ellipsis');
    }
  }

  /** 长度值换算：vp→rpx；百分比/带单位字符串透传。 */
  private length(value: unknown): string {
    if (typeof value === 'number' || typeof value === 'string') {
      return convertUnit(value, this.unitRatio);
    }
    return String(value);
  }

  /** padding/margin：单值 / 对象 { top, right, bottom, left } 展开为四值。 */
  private boxShorthand(value: unknown): string {
    if (typeof value === 'number' || typeof value === 'string') {
      return this.length(value);
    }
    const obj = asObject(value);
    return ['top', 'right', 'bottom', 'left']
      .map((side) => this.length(obj[side] ?? 0))
      .join(' ');
  }

  renderWxss(): string {
    const blocks: string[] = [];
    for (const [className, body] of this.classes) {
      const lines = [`.${className} {`];
      for (const decl of body.decls) lines.push(`  ${decl};`);
      for (const comment of body.comments) lines.push(`  ${comment}`);
      lines.push('}');
      blocks.push(lines.join('\n'));
    }
    return blocks.length === 0 ? '' : blocks.join('\n\n') + '\n';
  }
}

// ── 工具函数 ──

/** binding 表达式 → `{{}}` 文本（与 transform-wxml 同一序列化约定；L2 各链互不依赖，本地实现）。 */
function bindingText(expr: Extract<Expression, { kind: 'binding' }>): string {
  if (expr.template === undefined) return `{{${expr.path}}}`;
  return expr.template.split('${0}').join(`{{${expr.path}}}`);
}

/** 序列化调用参数（用于诊断与注释），如 `.blur(10)` 的 `10`。 */
function serializeArgs(call: StyleCall): string {
  return call.args
    .map((a) => (a.kind === 'static' ? JSON.stringify(a.value) : `{{${a.path}}}`))
    .join(', ');
}

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** offset 参数：`.offset(x, y)` 或 `.offset({ x, y })`。 */
function offsetArgs(args: unknown[]): [unknown, unknown] {
  if (args.length >= 2) return [args[0], args[1]];
  const obj = asObject(args[0]);
  return [obj['x'] ?? 0, obj['y'] ?? 0];
}
