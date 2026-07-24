import { createRule } from '../create-rule.js';
import { getDecoratorName } from '../utils.js';

type MessageIds = 'concurrent';

/**
 * no-concurrent：禁止 @Concurrent / worker 相关写法。
 * 对应 08 篇"不支持的语言特性"E1004（小程序 worker 模型不同）。
 */
export const noConcurrent = createRule<[], MessageIds>({
  name: 'no-concurrent',
  meta: {
    type: 'problem',
    docs: {
      description: '禁止 @Concurrent 并发装饰器（08 篇 E1004）',
    },
    messages: {
      concurrent:
        '@Concurrent / worker 相关能力不可编译：小程序 worker 模型不同（E1004），请把并发逻辑移入页面内异步任务',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return {
      Decorator(node) {
        if (getDecoratorName(node) === 'Concurrent') {
          context.report({ node, messageId: 'concurrent' });
        }
      },
    };
  },
});
