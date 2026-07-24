import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import type { TSESTree } from '@typescript-eslint/utils';

import { createRule } from '../create-rule.js';
import { getCallName } from '../utils.js';

type MessageIds = 'waterFlow' | 'onBackPress';

/**
 * no-degraded-capability：可编译但需降级的能力，编码期给出 warning。
 * 对应 08 篇"不支持/需降级的组件与能力"表中的降级条目
 * （WaterFlow → 双列 List 模拟；onBackPress 拦截 → 小程序无法拦截返回）。
 * 建议在配置中置为 warn（recommended 配置已如此）。
 */
export const noDegradedCapability = createRule<[], MessageIds>({
  name: 'no-degraded-capability',
  meta: {
    type: 'suggestion',
    docs: {
      description: '提示将降级处理的 ArkUI 能力（08 篇组件能力表，warning 级）',
    },
    messages: {
      waterFlow:
        'WaterFlow 将降级编译为双列 List 模拟（08 篇，warning），交互与性能有差异，建议直接使用 List/Grid',
      onBackPress:
        'onBackPress 返回拦截不可用：小程序无法拦截返回（08 篇，warning），请调整交互设计',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    function checkMethodName(key: TSESTree.PropertyName) {
      if (key.type === AST_NODE_TYPES.Identifier && key.name === 'onBackPress') {
        context.report({ node: key, messageId: 'onBackPress' });
      }
    }
    return {
      CallExpression(node) {
        if (getCallName(node) === 'WaterFlow') {
          context.report({ node, messageId: 'waterFlow' });
        }
      },
      MethodDefinition(node) {
        checkMethodName(node.key);
      },
      PropertyDefinition(node) {
        checkMethodName(node.key);
      },
    };
  },
});
