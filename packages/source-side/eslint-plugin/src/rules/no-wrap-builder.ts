import { createRule } from '../create-rule.js';
import { getCallName, getDecoratorName } from '../utils.js';

type MessageIds = 'wrapBuilder' | 'localBuilder';

/**
 * no-wrap-builder：禁止 wrapBuilder / @LocalBuilder 高阶用法。
 * 对应 08 篇"不支持的语言特性"E1005（需要运行时 VDOM，违背编译期直出原则）。
 */
export const noWrapBuilder = createRule<[], MessageIds>({
  name: 'no-wrap-builder',
  meta: {
    type: 'problem',
    docs: {
      description: '禁止 wrapBuilder / @LocalBuilder 动态组件（08 篇 E1005）',
    },
    messages: {
      wrapBuilder:
        'wrapBuilder 动态组件不可编译：需要运行时 VDOM，违背编译期直出原则（E1005），请改用静态组件引用或 @Builder',
      localBuilder:
        '@LocalBuilder 高阶用法不可编译（E1005），请改用 @Builder（编译为 template 或提升为组件）',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return {
      CallExpression(node) {
        if (getCallName(node) === 'wrapBuilder') {
          context.report({ node, messageId: 'wrapBuilder' });
        }
      },
      Decorator(node) {
        if (getDecoratorName(node) === 'LocalBuilder') {
          context.report({ node, messageId: 'localBuilder' });
        }
      },
    };
  },
});
