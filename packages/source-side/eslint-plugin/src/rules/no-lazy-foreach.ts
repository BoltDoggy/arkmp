import { AST_NODE_TYPES } from '@typescript-eslint/utils';

import { createRule } from '../create-rule.js';
import { getCallName } from '../utils.js';

type MessageIds = 'lazyForEach' | 'dataSource';

/**
 * no-lazy-foreach：禁止 LazyForEach 与 IDataSource。
 * 对应 08 篇"不支持的语言特性"E1001（小程序无等价懒加载协议）。
 */
export const noLazyForEach = createRule<[], MessageIds>({
  name: 'no-lazy-foreach',
  meta: {
    type: 'problem',
    docs: {
      description: '禁止 LazyForEach / IDataSource（08 篇 E1001）',
    },
    messages: {
      lazyForEach:
        'LazyForEach 不可编译：小程序无等价懒加载协议（E1001），请改用 ForEach（编译为 scroll-view 分页模拟）',
      dataSource:
        'IDataSource 是 LazyForEach 配套协议，不可编译（E1001），请改用普通数组 + ForEach',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return {
      CallExpression(node) {
        if (getCallName(node) === 'LazyForEach') {
          context.report({ node, messageId: 'lazyForEach' });
        }
      },
      TSClassImplements(node) {
        if (
          node.expression.type === AST_NODE_TYPES.Identifier &&
          node.expression.name === 'IDataSource'
        ) {
          context.report({ node, messageId: 'dataSource' });
        }
      },
    };
  },
});
