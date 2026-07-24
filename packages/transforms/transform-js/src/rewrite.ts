/**
 * 赋值改写器（05 篇「编译期改写」）：用 TypeScript Compiler API 扫描方法体
 * 源码文本，把对 @State / @Link 字段的顶层赋值改写为 runtime 桥接调用。
 *
 * 改写规则（05 篇表格，setData 由 runtime `__set` 桥接方法承载，
 * 批量合并由 runtime 的同 tick 调度完成，见 05 篇「运行时兜底」）：
 *
 * | 源码写法 | 改写产物（@State 字段） |
 * | --- | --- |
 * | `this.count = 1` | `this.__set('count', 1)` |
 * | `this.count++` | `this.__set('count', this.count + 1)` |
 * | `this.count += 2` | `this.__set('count', this.count + (2))` |
 * | `this.user.name = 'x'` | `this.__set('user.name', 'x')` |
 * | `this.list[0] = 9` | `this.__set('list[0]', 9)` |
 *
 * @Link 字段的赋值改写为双向绑定桥接（05 篇「@Link」）：
 * `this.isOn = true` → `this.__set_isOn(true)`（`__set_isOn` 由
 * transform-js 生成，内部 setData + triggerEvent 回写父组件）。
 *
 * 不改写、交给运行时兜底的场景（05 篇）：
 * - 动态键访问 `this.list[i] = 9`：warning W2001，保留原写法
 *   （@State 的访问器 getter 返回 Proxy 包装对象，运行时兜底刷新）；
 * - 表达式位置的赋值（如 `foo(this.count = 1)`）：@State 由访问器
 *   setter 兜底，不warning；@Link 无访问器，warning W2001；
 * - @Link 字段的嵌套写入（`this.obj.field = 1`）：无法构造整体回传值，
 *   warning W2001，保留原写法。
 */

import ts from 'typescript';

/** 改写目标：@State 与 @Link 字段名集合。 */
export interface RewriteTargets {
  states: ReadonlySet<string>;
  links: ReadonlySet<string>;
}

export interface RewriteWarning {
  /** 诊断码，见 08 篇诊断码总表（W2xxx：状态写法降级） */
  code: string;
  message: string;
}

export interface RewriteResult {
  code: string;
  warnings: RewriteWarning[];
}

/** 改写诊断码。 */
export const REWRITE_WARNING_CODES = {
  /** 动态键 / 无法静态改写的赋值，降级运行时 Proxy 兜底（08 篇 W2001） */
  DYNAMIC_FALLBACK: 'W2001',
} as const;

const WRAP_PREFIX = 'function __arkmp__() {\n';
const WRAP_SUFFIX = '\n}';

const COMPOUND_OPERATORS: Partial<Record<ts.SyntaxKind, string>> = {
  [ts.SyntaxKind.PlusEqualsToken]: '+',
  [ts.SyntaxKind.MinusEqualsToken]: '-',
  [ts.SyntaxKind.AsteriskEqualsToken]: '*',
  [ts.SyntaxKind.SlashEqualsToken]: '/',
  [ts.SyntaxKind.PercentEqualsToken]: '%',
};

interface ThisPath {
  /** 根字段名，如 `count`、`user` */
  root: string;
  /** setData 路径，如 `count`、`user.name`、`list[0]` */
  path: string;
  /** 是否含动态键段（`this.list[i]`） */
  dynamic: boolean;
  /** 嵌套段数（1 表示直接字段赋值） */
  depth: number;
}

function isIdentifierText(text: string): boolean {
  return /^[$A-Z_a-z][$\w]*$/.test(text);
}

/** 解析 `this.a.b[0]` 形式的访问链；非 this 根返回 null。 */
function resolveThisPath(expr: ts.Expression): ThisPath | null {
  const segments: string[] = [];
  let dynamic = false;
  let current: ts.Expression = expr;
  for (;;) {
    if (ts.isPropertyAccessExpression(current)) {
      segments.unshift(current.name.text);
      current = current.expression;
    } else if (ts.isElementAccessExpression(current)) {
      const arg = current.argumentExpression;
      if (arg !== undefined && ts.isNumericLiteral(arg)) {
        segments.unshift(`[${arg.text}]`);
      } else if (arg !== undefined && ts.isStringLiteral(arg) && isIdentifierText(arg.text)) {
        segments.unshift(arg.text);
      } else {
        dynamic = true;
        segments.unshift('[?]');
      }
      current = current.expression;
    } else if (current.kind === ts.SyntaxKind.ThisKeyword) {
      break;
    } else {
      return null;
    }
  }
  if (segments.length === 0 || dynamic) {
    return segments.length === 0 ? null : { root: segments[0], path: segments[0], dynamic: true, depth: segments.length };
  }
  let path = segments[0];
  for (const seg of segments.slice(1)) {
    path += seg.startsWith('[') ? seg : `.${seg}`;
  }
  return { root: segments[0], path, dynamic: false, depth: segments.length };
}

interface Edit {
  start: number;
  end: number;
  text: string;
}

/**
 * 改写单个方法体。`body` 为方法/回调体源码文本（不含外层花括号）。
 * 纯函数；无法改写的写法保留原文并给出 warning。
 */
export function rewriteBody(body: string, targets: RewriteTargets): RewriteResult {
  const source = WRAP_PREFIX + body + WRAP_SUFFIX;
  const sourceFile = ts.createSourceFile('body.ts', source, ts.ScriptTarget.ES2020, true, ts.ScriptKind.TS);
  const edits: Edit[] = [];
  const warnings: RewriteWarning[] = [];

  const warnDynamic = (text: string, reason: string): void => {
    warnings.push({
      code: REWRITE_WARNING_CODES.DYNAMIC_FALLBACK,
      message: `无法静态改写的赋值 \`${text}\`：${reason}，保留原写法由运行时兜底`,
    });
  };

  /** 生成 @State 字段的桥接调用文本。 */
  const stateCall = (path: string, value: string): string => `this.__set('${path}', ${value})`;

  const rewriteTarget = (expr: ts.Expression, valueText: string): string | null => {
    const info = resolveThisPath(expr);
    if (info === null) return null;
    if (targets.states.has(info.root)) {
      if (info.dynamic) {
        warnDynamic(expr.getText(sourceFile), '含动态键');
        return null;
      }
      return stateCall(info.path, valueText);
    }
    if (targets.links.has(info.root)) {
      // @Link：仅支持直接字段赋值（需要整体值回传父组件）
      if (info.dynamic || info.depth > 1) {
        warnDynamic(expr.getText(sourceFile), '@Link 字段的嵌套/动态键写入无法构造整体回传值');
        return null;
      }
      return `this.__set_${info.root}(${valueText})`;
    }
    return null;
  };

  const visit = (node: ts.Node): void => {
    // 赋值表达式：this.x = v / this.x += v（仅语句级改写）
    if (ts.isBinaryExpression(node)) {
      const op = node.operatorToken.kind;
      const isPlainAssign = op === ts.SyntaxKind.EqualsToken;
      const compound = COMPOUND_OPERATORS[op];
      if (isPlainAssign || compound !== undefined) {
        const statementLevel = ts.isExpressionStatement(node.parent);
        const info = resolveThisPath(node.left);
        if (info !== null && (targets.states.has(info.root) || targets.links.has(info.root))) {
          if (!statementLevel) {
            if (targets.links.has(info.root)) {
              warnDynamic(node.getText(sourceFile), '表达式位置的 @Link 赋值无访问器兜底');
            }
            // @State 表达式位置赋值由访问器 setter 兜底，不告警
          } else {
            const rhs = node.right.getText(sourceFile);
            const lhs = node.left.getText(sourceFile);
            const value = isPlainAssign ? rhs : `${lhs} ${compound} (${rhs})`;
            const text = rewriteTarget(node.left, value);
            if (text !== null) edits.push({ start: node.getStart(sourceFile), end: node.getEnd(), text });
          }
        }
      }
    }

    // 自增自减：this.x++ / --this.x（仅语句级改写）
    if (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) {
      const op = node.operator;
      if (op === ts.SyntaxKind.PlusPlusToken || op === ts.SyntaxKind.MinusMinusToken) {
        const sign = op === ts.SyntaxKind.PlusPlusToken ? '+' : '-';
        const operand = node.operand;
        const info = resolveThisPath(operand);
        if (info !== null && (targets.states.has(info.root) || targets.links.has(info.root))) {
          if (!ts.isExpressionStatement(node.parent)) {
            if (targets.links.has(info.root)) {
              warnDynamic(node.getText(sourceFile), '表达式位置的 @Link 自增自减无访问器兜底');
            }
          } else {
            const lhs = operand.getText(sourceFile);
            const text = rewriteTarget(operand, `${lhs} ${sign} 1`);
            if (text !== null) edits.push({ start: node.getStart(sourceFile), end: node.getEnd(), text });
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  // 从后往前应用编辑，再去掉包装函数头尾
  let out = source;
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    out = out.slice(0, edit.start) + edit.text + out.slice(edit.end);
  }
  return { code: out.slice(WRAP_PREFIX.length, out.length - WRAP_SUFFIX.length), warnings };
}
