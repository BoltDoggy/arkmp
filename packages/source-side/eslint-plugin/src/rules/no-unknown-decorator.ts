import { createRule } from '../create-rule.js';
import { getDecoratorName, KNOWN_DECORATORS } from '../utils.js';

type MessageIds = 'unknownDecorator';

/**
 * no-unknown-decorator：装饰器白名单检查。
 * 对应 08 篇"支持的语言特性"装饰器行——白名单外的装饰器编译期报 E1xxx。
 */
export const noUnknownDecorator = createRule<[], MessageIds>({
  name: 'no-unknown-decorator',
  meta: {
    type: 'problem',
    docs: {
      description: '禁止使用 ArkMP 装饰器白名单之外的装饰器（08 篇装饰器白名单）',
    },
    messages: {
      unknownDecorator:
        '装饰器 @{{name}} 不在 ArkMP 支持的白名单中（08 篇），仅支持：@Entry/@Component/@State/@Prop/@Link/@Provide/@Consume/@Observed/@ObjectLink/@Watch/@Builder/@Styles/@Extend/@StorageLink',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return {
      Decorator(node) {
        const name = getDecoratorName(node);
        if (name === null || !KNOWN_DECORATORS.has(name)) {
          context.report({
            node,
            messageId: 'unknownDecorator',
            data: { name: name ?? source() },
          });
        }
        function source(): string {
          return context.sourceCode.getText(node.expression);
        }
      },
    };
  },
});
