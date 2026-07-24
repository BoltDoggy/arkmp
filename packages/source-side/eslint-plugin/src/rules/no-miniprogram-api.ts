import { AST_NODE_TYPES } from '@typescript-eslint/utils';

import { createRule } from '../create-rule.js';

type MessageIds = 'wxApi' | 'setData' | 'thisData';

/**
 * no-miniprogram-api：禁止在 .ets 源码中直接写小程序产物概念。
 * 对应 08 篇"状态写法约束"硬性禁止条目与诊断码表 E3xxx
 * （wx.* 直接调用、this.data、setData 均属平台概念泄漏）。
 */
export const noMiniprogramApi = createRule<[], MessageIds>({
  name: 'no-miniprogram-api',
  meta: {
    type: 'problem',
    docs: {
      description: '禁止直接使用 wx.* / this.data / setData 等小程序产物 API（08 篇 E3xxx）',
    },
    messages: {
      wxApi:
        '禁止直接调用 wx.*（E3xxx）：源码侧请使用 @arkmp/api 命名空间（如 http.request / prompt.showToast），编译期会自动映射',
      setData:
        '禁止直接调用 setData（E3xxx）：请直接赋值 this.xxx，编译期会精确改写为 setData（08 篇状态写法约束）',
      thisData:
        '源码中没有 data 概念（E3xxx）：请直接访问 this.xxx，this.data 是编译产物实现细节（08 篇状态写法约束）',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return {
      MemberExpression(node) {
        if (node.object.type === AST_NODE_TYPES.Identifier && node.object.name === 'wx') {
          context.report({ node, messageId: 'wxApi' });
          return;
        }
        if (
          node.object.type === AST_NODE_TYPES.ThisExpression &&
          !node.computed &&
          node.property.type === AST_NODE_TYPES.Identifier &&
          node.property.name === 'data'
        ) {
          context.report({ node, messageId: 'thisData' });
        }
      },
      CallExpression(node) {
        if (node.callee.type === AST_NODE_TYPES.Identifier && node.callee.name === 'setData') {
          context.report({ node, messageId: 'setData' });
        }
      },
    };
  },
});
