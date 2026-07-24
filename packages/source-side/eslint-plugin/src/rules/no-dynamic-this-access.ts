import { AST_NODE_TYPES } from '@typescript-eslint/utils';

import { createRule } from '../create-rule.js';

type MessageIds = 'dynamicThisAccess';

/**
 * no-dynamic-this-access：禁止 this[key] 非常量键的动态属性访问。
 * 对应 08 篇 W2001——无法静态改写为 setData，将落入 Proxy 兜底（降级 warning）。
 */
export const noDynamicThisAccess = createRule<[], MessageIds>({
  name: 'no-dynamic-this-access',
  meta: {
    type: 'suggestion',
    docs: {
      description: '禁止 this[key] 动态属性访问（08 篇 W2001，降级 Proxy 兜底）',
    },
    messages: {
      dynamicThisAccess:
        'this[{{key}}] 动态键无法静态改写为 setData，将落入 Proxy 兜底（W2001），请改用字面量键直接访问',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return {
      MemberExpression(node) {
        if (!node.computed) {
          return;
        }
        if (node.object.type !== AST_NODE_TYPES.ThisExpression) {
          return;
        }
        if (node.property.type === AST_NODE_TYPES.Literal) {
          // this['count'] 等价于 this.count，可静态改写
          return;
        }
        context.report({
          node,
          messageId: 'dynamicThisAccess',
          data: { key: context.sourceCode.getText(node.property) },
        });
      },
    };
  },
});
