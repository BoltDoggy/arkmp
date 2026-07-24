import { AST_NODE_TYPES } from '@typescript-eslint/utils';

import { createRule } from '../create-rule.js';
import { UI_COMPONENTS } from '../utils.js';

type MessageIds = 'multiRoot';

/** 允许作为 build() 根的非容器调用（ForEach 列表渲染） */
const ROOT_EXEMPT: ReadonlySet<string> = new Set(['ForEach']);

/**
 * single-root-node：每个 build() 最多一个根节点。
 * 对应 08 篇"build() 约束"第 4 条（ArkUI 同规）。
 */
export const singleRootNode = createRule<[], MessageIds>({
  name: 'single-root-node',
  meta: {
    type: 'problem',
    docs: {
      description: 'build() 最多一个根节点（08 篇 build() 约束）',
    },
    messages: {
      multiRoot:
        'build() 最多一个根节点：{{name}}() 是多余的根调用，请用 Column/Row/Stack 包裹（08 篇 build() 约束）',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return {
      MethodDefinition(node) {
        if (node.key.type !== AST_NODE_TYPES.Identifier || node.key.name !== 'build') {
          return;
        }
        const body = node.value.body;
        if (!body) {
          return;
        }
        const rootCalls = body.body.filter(
          (statement) =>
            statement.type === AST_NODE_TYPES.ExpressionStatement &&
            isRootUiCall(statement.expression),
        );
        for (const extra of rootCalls.slice(1)) {
          const name =
            extra.type === AST_NODE_TYPES.ExpressionStatement
              ? getRootCallName(extra.expression)
              : null;
          context.report({ node: extra, messageId: 'multiRoot', data: { name: name ?? '?' } });
        }
      },
    };
    function isRootUiCall(expr: import('@typescript-eslint/utils').TSESTree.Expression) {
      const name = getRootCallName(expr);
      return name !== null && UI_COMPONENTS.has(name) && !ROOT_EXEMPT.has(name);
    }
  },
});

/** 剥开链式调用，取最内层调用的标识符名（Column().width(100) → 'Column'） */
function getRootCallName(
  expr: import('@typescript-eslint/utils').TSESTree.Expression,
): string | null {
  let current: import('@typescript-eslint/utils').TSESTree.Expression = expr;
  while (current.type === AST_NODE_TYPES.CallExpression) {
    if (current.callee.type === AST_NODE_TYPES.Identifier) {
      return current.callee.name;
    }
    if (
      current.callee.type === AST_NODE_TYPES.MemberExpression &&
      current.callee.object.type === AST_NODE_TYPES.CallExpression
    ) {
      current = current.callee.object;
      continue;
    }
    return null;
  }
  return null;
}
