import type { Expression } from '@arkmp/ir';
import ts from 'typescript';

/**
 * 表达式分类（02 篇②「表达式分类」）：
 * - 纯静态表达式（字面量、不含状态引用的常量运算、大写开头的常量引用如
 *   `FlexAlign.Center`）→ `{ kind: 'static', value }`，编译期已求值；
 * - 依赖状态的表达式（含 `this.xxx`）与迭代变量引用（`item.name`）→
 *   `{ kind: 'binding', path, template }`，模板中 `${i}` 为第 i 个绑定路径的占位。
 */

type EvalResult = { ok: true; value: unknown } | { ok: false };

const OK = (value: unknown): EvalResult => ({ ok: true, value });
const FAIL: EvalResult = { ok: false };

/** 尝试编译期求值；无法求值时返回 FAIL。 */
function evaluateStatic(expr: ts.Expression): EvalResult {
  if (ts.isNumericLiteral(expr)) return OK(Number(expr.text));
  if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) return OK(expr.text);
  if (expr.kind === ts.SyntaxKind.TrueKeyword) return OK(true);
  if (expr.kind === ts.SyntaxKind.FalseKeyword) return OK(false);
  if (expr.kind === ts.SyntaxKind.NullKeyword) return OK(null);
  if (ts.isIdentifier(expr) && expr.text === 'undefined') return OK(undefined);
  if (ts.isParenthesizedExpression(expr)) return evaluateStatic(expr.expression);

  if (ts.isPrefixUnaryExpression(expr)) {
    const operand = evaluateStatic(expr.operand);
    if (!operand.ok || typeof operand.value !== 'number') return FAIL;
    if (expr.operator === ts.SyntaxKind.MinusToken) return OK(-operand.value);
    if (expr.operator === ts.SyntaxKind.PlusToken) return OK(operand.value);
    return FAIL;
  }

  if (ts.isObjectLiteralExpression(expr)) {
    const result: Record<string, unknown> = {};
    for (const prop of expr.properties) {
      if (!ts.isPropertyAssignment(prop)) return FAIL; // 展开/简写/方法不可静态求值
      if (!ts.isIdentifier(prop.name) && !ts.isStringLiteral(prop.name) && !ts.isNumericLiteral(prop.name)) {
        return FAIL;
      }
      const value = evaluateStatic(prop.initializer);
      if (!value.ok) return FAIL;
      result[prop.name.text] = value.value;
    }
    return OK(result);
  }

  if (ts.isArrayLiteralExpression(expr)) {
    const result: unknown[] = [];
    for (const element of expr.elements) {
      if (ts.isSpreadElement(element) || ts.isOmittedExpression(element)) return FAIL;
      const value = evaluateStatic(element);
      if (!value.ok) return FAIL;
      result.push(value.value);
    }
    return OK(result);
  }

  if (ts.isBinaryExpression(expr)) {
    const left = evaluateStatic(expr.left);
    const right = evaluateStatic(expr.right);
    if (!left.ok || !right.ok) return FAIL;
    const l = left.value;
    const r = right.value;
    switch (expr.operatorToken.kind) {
      case ts.SyntaxKind.PlusToken:
        if (typeof l === 'string' || typeof r === 'string') return OK(String(l) + String(r));
        if (typeof l === 'number' && typeof r === 'number') return OK(l + r);
        return FAIL;
      case ts.SyntaxKind.MinusToken:
        return typeof l === 'number' && typeof r === 'number' ? OK(l - r) : FAIL;
      case ts.SyntaxKind.AsteriskToken:
        return typeof l === 'number' && typeof r === 'number' ? OK(l * r) : FAIL;
      case ts.SyntaxKind.SlashToken:
        return typeof l === 'number' && typeof r === 'number' ? OK(l / r) : FAIL;
      case ts.SyntaxKind.PercentToken:
        return typeof l === 'number' && typeof r === 'number' ? OK(l % r) : FAIL;
      default:
        return FAIL;
    }
  }

  // 大写开头的常量引用（如 FlexAlign.Center、Color.Red）：编译期常量，
  // 不在此求值，保留源码文本由 L2 样式链翻译。
  if (ts.isPropertyAccessExpression(expr)) {
    let root: ts.Expression = expr;
    while (ts.isPropertyAccessExpression(root)) root = root.expression;
    if (ts.isIdentifier(root) && /^[A-Z]/.test(root.text)) return OK(expr.getText());
  }

  return FAIL;
}

/** 绑定路径及其在表达式中的源码文本（用于模板占位替换）。 */
interface BindingPath {
  /** 状态路径（去掉 `this.` 前缀），如 'count'、'form.id'、'item.name' */
  path: string;
  /** 源码文本，如 'this.count' */
  text: string;
}

/** 若 expr 是（可能以 `this` 开头的）纯标识符链，返回其路径文本；否则返回 null。 */
function dottedPath(expr: ts.Expression): string | null {
  const parts: string[] = [];
  let node: ts.Expression = expr;
  while (ts.isPropertyAccessExpression(node)) {
    parts.unshift(node.name.text);
    node = node.expression;
  }
  if (node.kind === ts.SyntaxKind.ThisKeyword) return parts.join('.');
  if (ts.isIdentifier(node)) {
    parts.unshift(node.text);
    return parts.join('.');
  }
  return null;
}

/** 收集表达式中的绑定路径（最外层标识符链，含 this.xxx 与迭代变量引用）。 */
function collectBindingPaths(node: ts.Node, out: BindingPath[]): void {
  if (ts.isPropertyAccessExpression(node)) {
    const path = dottedPath(node);
    if (path !== null) {
      // this.xxx 或小写开头的迭代变量引用（item.name）；
      // 大写开头的常量引用（FlexAlign.Center）不是绑定，但也不再深入其子节点
      const root = rootOf(node);
      if (root.kind === ts.SyntaxKind.ThisKeyword || (ts.isIdentifier(root) && /^[a-z_$]/.test(root.text))) {
        out.push({ path, text: node.getText() });
      }
      return;
    }
  } else if (ts.isIdentifier(node)) {
    const parent = node.parent;
    // 排除属性访问的 `.name` 部分（链已在最外层处理）与 undefined 关键字
    if (node.text !== 'undefined' && !(ts.isPropertyAccessExpression(parent) && parent.name === node)) {
      out.push({ path: node.text, text: node.text });
      return;
    }
  }
  ts.forEachChild(node, (child) => collectBindingPaths(child, out));
}

function rootOf(node: ts.PropertyAccessExpression): ts.Expression {
  let root: ts.Expression = node;
  while (ts.isPropertyAccessExpression(root)) root = root.expression;
  return root;
}

/** 将模板字符串表达式序列化为绑定模板（`点击次数：${this.count}` → `点击次数：${0}`）。 */
function classifyTemplate(expr: ts.TemplateExpression, sourceFile: ts.SourceFile): Expression {
  const spans: string[] = [];
  const paths: BindingPath[] = [];
  for (const span of expr.templateSpans) {
    const spanPaths: BindingPath[] = [];
    collectBindingPaths(span.expression, spanPaths);
    if (spanPaths.length === 1 && dottedPath(span.expression) !== null) {
      // 整个插值就是一条绑定路径
      paths.push(spanPaths[0]);
      spans.push(`${paths.length - 1}`);
    } else {
      // 复合插值：保留源码文本，路径占位替换
      let text = span.expression.getText(sourceFile);
      for (const p of spanPaths) {
        paths.push(p);
        text = text.replace(p.text, `\${${paths.length - 1}}`);
      }
      spans.push(text);
    }
  }
  let template = expr.head.text;
  expr.templateSpans.forEach((span, i) => {
    template += `\${${spans[i]}}${span.literal.text}`;
  });
  const result: Expression = {
    kind: 'binding',
    path: paths[0]?.path ?? '',
    template,
  };
  if (paths.length > 1) {
    result.paths = paths.map((p) => p.path);
  }
  return result;
}

/** 取对象属性名；不支持的计算属性名返回 null。 */
function propKey(name: ts.PropertyName): string | null {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text;
  if (ts.isNumericLiteral(name)) return name.text;
  return null;
}

/**
 * 对象字面量 → { kind: 'object', properties }：逐属性分类。
 * 展开运算符、方法简写、计算属性名等不支持时退回源码文本。
 */
function classifyObjectLiteral(
  expr: ts.ObjectLiteralExpression,
  sourceFile: ts.SourceFile,
  methodSet?: Set<string>,
): Expression {
  const properties: Record<string, Expression> = {};
  for (const prop of expr.properties) {
    if (!ts.isPropertyAssignment(prop)) {
      // 展开运算符 / 方法简写 / get/set 访问器：退回源码文本
      return { kind: 'static', value: expr.getText(sourceFile) };
    }
    const key = propKey(prop.name);
    if (key === null) {
      return { kind: 'static', value: expr.getText(sourceFile) };
    }
    properties[key] = classifyExpression(prop.initializer, sourceFile, methodSet);
  }
  return { kind: 'object', properties };
}

/**
 * 将 ts 表达式序列化为 IR Expression。
 * methodSet 传入时（build()/@Builder 上下文），`this.method(args)` 中 method 在集合内
 * 的调用会被分类为 `method-call`，编译为 WXS 函数调用。
 */
export function classifyExpression(
  expr: ts.Expression,
  sourceFile: ts.SourceFile,
  methodSet?: Set<string>,
): Expression {
  const evaluated = evaluateStatic(expr);
  if (evaluated.ok) return { kind: 'static', value: evaluated.value };

  if (ts.isTemplateExpression(expr)) return classifyTemplate(expr, sourceFile);

  // 纯路径绑定：`this.count` → { kind: 'binding', path: 'count' }
  const direct = dottedPath(expr);
  if (direct !== null && (ts.isPropertyAccessExpression(expr) || ts.isIdentifier(expr))) {
    return { kind: 'binding', path: direct };
  }

  // 方法调用：`this.method(args)` → { kind: 'method-call', method, args }
  if (methodSet && ts.isCallExpression(expr)) {
    const callee = expr.expression;
    if (
      ts.isPropertyAccessExpression(callee) &&
      callee.expression.kind === ts.SyntaxKind.ThisKeyword &&
      methodSet.has(callee.name.text)
    ) {
      return {
        kind: 'method-call',
        method: callee.name.text,
        args: expr.arguments.map((a) => classifyExpression(a, sourceFile, methodSet)),
      };
    }
  }

  // 对象字面量：逐属性分类（保留 key→value 结构，供自定义组件 props 拆分）
  if (ts.isObjectLiteralExpression(expr)) {
    return classifyObjectLiteral(expr, sourceFile, methodSet);
  }

  // 复合表达式：`this.count + 1` → { kind: 'binding', path: 'count', template: '${0} + 1', fullExpression: true }
  // 多路径表达式：`this.a + this.b` → { kind: 'binding', path: 'a', paths: ['a','b'], template: '${0} + ${1}', fullExpression: true }
  // 三元表达式：`this.isFull ? 'a' : 'b'` → { kind: 'binding', path: 'isFull', template: "${0} ? 'a' : 'b'", fullExpression: true }
  const paths: BindingPath[] = [];
  collectBindingPaths(expr, paths);
  if (paths.length > 0) {
    let template = expr.getText(sourceFile);
    paths.forEach((p, i) => {
      template = template.replace(p.text, `\${${i}}`);
    });
    const result: Expression = { kind: 'binding', path: paths[0].path, template, fullExpression: true };
    if (paths.length > 1) {
      result.paths = paths.map((p) => p.path);
    }
    return result;
  }

  // 既不可静态求值也无状态引用（如 `new Date()`）：保留源码文本，
  // 视为编译期常量，由后续阶段决定是否支持。
  return { kind: 'static', value: expr.getText(sourceFile) };
}

// ── WXS 合规检查 ──

/**
 * 检查方法体是否符合 WXS 约束（纯函数、不引用 this、ES5 子集）。
 * WXS 运行在渲染层沙箱中，不能访问组件状态、不能使用 ES6+ 语法。
 */
export function isWxsEligible(method: ts.MethodDeclaration): boolean {
  if (method.body === undefined) return false;

  let eligible = true;

  function visit(node: ts.Node): void {
    if (!eligible) return;

    // 不能引用 this（WXS 是纯沙箱）
    if (node.kind === ts.SyntaxKind.ThisKeyword) {
      eligible = false;
      return;
    }

    // 不能使用 ES6+ 语法
    if (ts.isArrowFunction(node)) {
      eligible = false;
      return;
    }
    if (ts.isTemplateExpression(node)) {
      eligible = false;
      return;
    }
    if (ts.isVariableDeclarationList(node)) {
      const flags = node.flags;
      if ((flags & ts.NodeFlags.Let) !== 0 || (flags & ts.NodeFlags.Const) !== 0) {
        eligible = false;
        return;
      }
    }

    // 不能有解构绑定
    if (ts.isObjectBindingPattern(node) || ts.isArrayBindingPattern(node)) {
      eligible = false;
      return;
    }

    ts.forEachChild(node, visit);
  }

  ts.forEachChild(method.body, visit);
  return eligible;
}
