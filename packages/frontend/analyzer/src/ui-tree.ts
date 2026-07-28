import type { Diagnostic } from '@arkmp/diagnostics';
import { errorDiagnostic } from '@arkmp/diagnostics';
import type { EventCall, ForEachNode, IfNode, StyleCall, UIChildNode, UINode } from '@arkmp/ir';
import ts from 'typescript';
import { classifyExpression } from './expressions';

// 与 @arkmp/parser 的 CHAIN_MARKER 保持一致（analyzer 按 09 篇分层不依赖 parser，
// 仅以 ts.SourceFile 形式消费其产物；一致性由 tests 中的用例保证）。
const CHAIN_MARKER = '__arkmp_chain';

/** build() / @Builder 方法体 → UI 树构建过程的上下文。 */
export interface UITreeContext {
  sourceFile: ts.SourceFile;
  fileName: string;
  diagnostics: Diagnostic[];
  /** WXS 合格方法名集合（build() 中 this.xxx(args) 调用分类为 method-call） */
  methodNames?: Set<string>;
}

function posOf(node: ts.Node, ctx: UITreeContext): { line: number; column: number } {
  const pos = ts.getLineAndCharacterOfPosition(ctx.sourceFile, node.getStart(ctx.sourceFile));
  return { line: pos.line + 1, column: pos.character + 1 };
}

function error(ctx: UITreeContext, code: string, message: string, node: ts.Node): void {
  ctx.diagnostics.push(errorDiagnostic(code, message, { file: ctx.fileName, ...posOf(node, ctx) }));
}

/** 序列化块内语句为源码文本（方法体/回调体与 ts AST 解耦，02 篇③）。 */
export function bodyText(block: ts.Block, ctx: UITreeContext): string {
  return block.statements.map((s) => s.getText(ctx.sourceFile)).join('\n');
}

/** 链式调用名是否事件（onXxx）。 */
function isEventName(name: string): boolean {
  return /^on[A-Z]/.test(name);
}

/**
 * 将 build()/Builder 方法体的语句序列转换为 UI 子树列表。
 *
 * ArkUI 的「组件调用 + 尾花括号子节点」在 TS AST 中是「表达式语句 + 块语句」；
 * 尾随块之后的链式调用已被 parser 预处理为 `__arkmp_chain.xxx(...)` 表达式语句，
 * 这里将其挂回前一个组件节点。
 */
export function buildUIChildren(statements: readonly ts.Statement[], ctx: UITreeContext): UIChildNode[] {
  const children: UIChildNode[] = [];
  /** 最近一个可挂子节点/续链的组件节点 */
  let lastComponent: UINode | undefined;

  for (const statement of statements) {
    if (ts.isBlock(statement)) {
      // 尾花括号子节点块：挂到前一个组件节点
      if (lastComponent === undefined) {
        error(ctx, 'E1102', '悬空的子节点块：块之前没有可挂接的组件调用', statement);
      } else {
        lastComponent.children.push(...buildUIChildren(statement.statements, ctx));
      }
      continue;
    }

    if (ts.isIfStatement(statement)) {
      children.push(buildIfNode(statement, ctx));
      lastComponent = undefined;
      continue;
    }

    if (ts.isExpressionStatement(statement)) {
      const node = buildChainStatement(statement.expression, ctx, lastComponent);
      if (node === undefined) {
        lastComponent = undefined;
        continue;
      }
      if (node === 'continued') continue; // 续链已挂到 lastComponent
      children.push(node);
      lastComponent = node.type === 'component' ? node : undefined;
      continue;
    }

    // build() 约束（08 篇）：禁止副作用语句，组件声明必须是静态可枚举的调用结构
    error(ctx, 'E1102', `build() 中不支持的语句：${statement.getText(ctx.sourceFile)}`, statement);
    lastComponent = undefined;
  }

  return children;
}

/** 取方法体/build 体的唯一根节点（08 篇：每个 build() 最多一个根节点）。 */
export function buildRootTree(statements: readonly ts.Statement[], ctx: UITreeContext, owner: string): UINode {
  const children = buildUIChildren(statements, ctx);
  const first = children[0];
  if (children.length === 1 && first.type === 'component') return first;

  const anchor = statements[0] ?? ctx.sourceFile;
  error(
    ctx,
    'E1103',
    children.length === 0
      ? `${owner} 缺少根节点：build()/Builder 体为空`
      : `${owner} 必须有且仅有一个组件根节点（当前 ${children.length} 个顶层节点）`,
    anchor,
  );
  const fallback = children.find((c): c is UINode => c.type === 'component');
  return fallback ?? { type: 'component', component: 'Column', params: [], children: [], styleCalls: [], eventCalls: [] };
}

/**
 * 解析一条链式调用语句：
 * - 组件调用（`Column({...})`、`Text('a')`）→ UINode
 * - `ForEach(...)` → ForEachNode
 * - `__arkmp_chain.xxx(...)`（尾随块之后的续链）→ 挂到 lastComponent，返回 'continued'
 * - 无法识别 → 诊断并返回 undefined
 */
function buildChainStatement(
  expr: ts.Expression,
  ctx: UITreeContext,
  lastComponent: UINode | undefined,
): UIChildNode | 'continued' | undefined {
  // 自外向内剥链式调用：Text('a').fontSize(20).onClick(...) → chain = [fontSize, onClick]
  const chain: ts.CallExpression[] = [];
  let base: ts.Expression = expr;
  while (ts.isCallExpression(base) && ts.isPropertyAccessExpression(base.expression)) {
    chain.unshift(base);
    base = base.expression.expression;
  }

  // 续链标记：挂回前一个组件节点
  if (ts.isIdentifier(base) && base.text === CHAIN_MARKER) {
    if (lastComponent === undefined) {
      error(ctx, 'E1102', '悬空的链式调用：之前没有可挂接的组件调用', expr);
      return undefined;
    }
    applyChainCalls(lastComponent, chain, ctx);
    return 'continued';
  }

  // 组件调用基座：Identifier（无参组件）或 Identifier(...) 调用
  let componentName: string;
  let params: readonly ts.Expression[];
  if (ts.isCallExpression(base) && ts.isIdentifier(base.expression)) {
    componentName = base.expression.text;
    params = base.arguments;
  } else if (ts.isIdentifier(base) && chain.length > 0) {
    componentName = base.text;
    params = [];
  } else {
    error(ctx, 'E1102', `无法识别的 UI 表达式：${expr.getText(ctx.sourceFile)}`, expr);
    return undefined;
  }

  if (componentName === 'ForEach') {
    if (!ts.isCallExpression(base)) {
      error(ctx, 'E1102', 'ForEach 必须以函数调用形式使用', expr);
      return undefined;
    }
    return buildForEachNode(base, ctx);
  }

  const node: UINode = {
    type: 'component',
    component: componentName,
    params: params.map((p) => classifyExpression(p, ctx.sourceFile, ctx.methodNames)),
    children: [],
    styleCalls: [],
    eventCalls: [],
  };
  applyChainCalls(node, chain, ctx);
  return node;
}

/** 将链式调用分类挂到组件节点：onXxx → eventCalls，其余 → styleCalls。 */
function applyChainCalls(target: UINode, chain: ts.CallExpression[], ctx: UITreeContext): void {
  for (const call of chain) {
    const name = (call.expression as ts.PropertyAccessExpression).name.text;
    if (isEventName(name)) {
      target.eventCalls.push(buildEventCall(name, call, ctx));
    } else {
      const styleCall: StyleCall = {
        name,
        args: call.arguments.map((arg) => classifyExpression(arg, ctx.sourceFile, ctx.methodNames)),
      };
      target.styleCalls.push(styleCall);
    }
  }
}

/** 事件调用：回调体序列化为源码文本（02 篇④）。 */
function buildEventCall(name: string, call: ts.CallExpression, ctx: UITreeContext): EventCall {
  const handler = call.arguments[0];
  if (handler !== undefined && (ts.isArrowFunction(handler) || ts.isFunctionExpression(handler))) {
    const body = ts.isBlock(handler.body) ? bodyText(handler.body, ctx) : handler.body.getText(ctx.sourceFile);
    return { name, body };
  }
  error(ctx, 'E1102', `事件 ${name} 的回调必须是箭头函数/函数表达式`, call);
  return { name, body: '' };
}

/** if/else if/else → IfNode（else-if 链表示为 elseChildren 中嵌套的 IfNode）。 */
function buildIfNode(statement: ts.IfStatement, ctx: UITreeContext): IfNode {
  const node: IfNode = {
    type: 'if',
    condition: classifyExpression(statement.expression, ctx.sourceFile, ctx.methodNames),
    children: buildBranchChildren(statement.thenStatement, ctx),
    elseChildren: [],
  };
  if (statement.elseStatement !== undefined) {
    if (ts.isIfStatement(statement.elseStatement)) {
      node.elseChildren = [buildIfNode(statement.elseStatement, ctx)];
    } else {
      node.elseChildren = buildBranchChildren(statement.elseStatement, ctx);
    }
  }
  return node;
}

/** 分支体：块语句 → 递归子树；单条表达式语句 → 单节点。 */
function buildBranchChildren(statement: ts.Statement, ctx: UITreeContext): UIChildNode[] {
  if (ts.isBlock(statement)) return buildUIChildren(statement.statements, ctx);
  return buildUIChildren([statement], ctx);
}

/** ForEach(items, (item, index) => { ... }, keyGenerator?) → ForEachNode。 */
function buildForEachNode(call: ts.CallExpression, ctx: UITreeContext): ForEachNode {
  const [itemsArg, generator, keyGenerator] = call.arguments;
  const node: ForEachNode = {
    type: 'foreach',
    items: itemsArg !== undefined ? classifyExpression(itemsArg, ctx.sourceFile, ctx.methodNames) : { kind: 'static', value: [] },
    itemName: 'item',
    loc: posOf(call, ctx),
    children: [],
  };

  if (generator === undefined || !ts.isArrowFunction(generator)) {
    error(ctx, 'E1102', 'ForEach 缺少条目生成器：(item, index) => { ... }', call);
    return node;
  }

  const [itemParam, indexParam] = generator.parameters;
  if (itemParam !== undefined && ts.isIdentifier(itemParam.name)) {
    node.itemName = itemParam.name.text;
  } else if (itemParam !== undefined) {
    error(ctx, 'E1102', 'ForEach 的条目参数必须是标识符（不支持解构）', itemParam);
  }
  if (indexParam !== undefined && ts.isIdentifier(indexParam.name)) {
    node.indexName = indexParam.name.text;
  }

  // 解析键生成函数：(item) => item.id → wx:key="id"，(item) => item → wx:key="*this"
  if (keyGenerator !== undefined && ts.isArrowFunction(keyGenerator)) {
    const keyBody = keyGenerator.body;
    // (item) => item → wx:key="*this"
    if (ts.isIdentifier(keyBody)) {
      node.keyField = '*this';
    } else if (ts.isPropertyAccessExpression(keyBody) && ts.isIdentifier(keyBody.expression)) {
      // (item) => item.id → wx:key="id"
      node.keyField = keyBody.name.text;
    }
  }

  if (ts.isBlock(generator.body)) {
    node.children = buildUIChildren(generator.body.statements, ctx);
  } else {
    // 表达式体：item => Text(item.name)
    const child = buildChainStatement(generator.body, ctx, undefined);
    if (child !== undefined && child !== 'continued') node.children = [child];
  }
  return node;
}
