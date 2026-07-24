import { AST_NODE_TYPES } from '@typescript-eslint/utils';

import { createRule } from '../create-rule.js';
import { getDecoratorName } from '../utils.js';

type MessageIds = 'nonLiteralArg' | 'missingArg';

/** 参数必须为字符串字面量的装饰器（编译期需静态求值，05 篇桥接产物依赖该键名） */
const LITERAL_ARG_DECORATORS: ReadonlySet<string> = new Set(['Watch', 'StorageLink']);

/**
 * require-literal-decorator-args：@Watch/@StorageLink 的参数必须是字符串字面量。
 * 对应 08 篇装饰器白名单的编译前提——装饰器参数需静态可求值，
 * 否则无法生成桥接代码（同 08 篇"装饰器参数非字面量"越界语法）。
 */
export const requireLiteralDecoratorArgs = createRule<[], MessageIds>({
  name: 'require-literal-decorator-args',
  meta: {
    type: 'problem',
    docs: {
      description: '@Watch/@StorageLink 的参数必须是字符串字面量（编译期静态求值）',
    },
    messages: {
      nonLiteralArg:
        '@{{name}} 的参数必须是字符串字面量（编译期需静态求值以生成桥接代码），不支持变量或表达式',
      missingArg: '@{{name}} 缺少参数：需要一个字符串字面量（如 @{{name}}(\'count\')）',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return {
      Decorator(node) {
        if (node.expression.type !== AST_NODE_TYPES.CallExpression) {
          return;
        }
        const name = getDecoratorName(node);
        if (name === null || !LITERAL_ARG_DECORATORS.has(name)) {
          return;
        }
        const args = node.expression.arguments;
        if (args.length === 0) {
          context.report({ node, messageId: 'missingArg', data: { name } });
          return;
        }
        for (const arg of args) {
          if (arg.type !== AST_NODE_TYPES.Literal || typeof arg.value !== 'string') {
            context.report({ node: arg, messageId: 'nonLiteralArg', data: { name } });
          }
        }
      },
    };
  },
});
