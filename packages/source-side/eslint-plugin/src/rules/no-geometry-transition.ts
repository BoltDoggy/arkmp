import { createRule } from '../create-rule.js';
import { getMemberCallName } from '../utils.js';

type MessageIds = 'geometryTransition';

/**
 * no-geometry-transition：禁止 geometryTransition 共享元素转场。
 * 对应 08 篇"不支持的语言特性"E1003（小程序无对应能力）。
 */
export const noGeometryTransition = createRule<[], MessageIds>({
  name: 'no-geometry-transition',
  meta: {
    type: 'problem',
    docs: {
      description: '禁止 geometryTransition 共享元素转场（08 篇 E1003）',
    },
    messages: {
      geometryTransition:
        'geometryTransition 共享元素转场不可编译：小程序无对应能力（E1003），请改用 transition() 进出场动画',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return {
      CallExpression(node) {
        if (getMemberCallName(node) === 'geometryTransition') {
          context.report({ node, messageId: 'geometryTransition' });
        }
      },
    };
  },
});
