import { createRule } from '../create-rule.js';
import { getCallName } from '../utils.js';

type MessageIds = 'unsupportedComponent';

/**
 * 编译期 error 级组件（08 篇"不支持/需降级的组件与能力"表）。
 * key: 组件名；value: 替代建议。
 */
const UNSUPPORTED_COMPONENTS: ReadonlyMap<string, string> = new Map([
  ['RelativeContainer', '建议改用 Column/Row/Stack（规则复杂且可读性差）'],
]);

/**
 * no-unsupported-component：禁止编译期 error 级的组件。
 * 对应 08 篇组件能力表（E1xxx）。
 */
export const noUnsupportedComponent = createRule<[], MessageIds>({
  name: 'no-unsupported-component',
  meta: {
    type: 'problem',
    docs: {
      description: '禁止不可编译的 ArkUI 组件（08 篇组件能力表，E1xxx）',
    },
    messages: {
      unsupportedComponent: '{{name}} 不可编译（E1xxx）：{{advice}}',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return {
      CallExpression(node) {
        const name = getCallName(node);
        const advice = name === null ? undefined : UNSUPPORTED_COMPONENTS.get(name);
        if (name !== null && advice !== undefined) {
          context.report({ node, messageId: 'unsupportedComponent', data: { name, advice } });
        }
      },
    };
  },
});
