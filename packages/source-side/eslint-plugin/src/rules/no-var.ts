import { createRule } from '../create-rule.js';

type MessageIds = 'noVar';

/**
 * no-var：禁止 var 声明，改用 let / const。
 *
 * 风格建议（非编译限制）：var 不影响编译，但 ArkTS 建议避免使用——
 * 变量提升与函数作用域语义和块级作用域不一致，ArkTS 子集与产物均为块级作用域，
 * var 无收益。详见 08 篇「ArkTS 编码风格建议」。
 */
export const noVar = createRule<[], MessageIds>({
  name: 'no-var',
  meta: {
    type: 'suggestion',
    docs: {
      description: '禁止 var 声明，改用 let / const（08 篇 ArkTS 编码风格建议）',
    },
    messages: {
      noVar: "ArkTS 建议避免使用 'var'，请使用 'let' 或 'const'",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return {
      VariableDeclaration(node) {
        if (node.kind === 'var') {
          context.report({ node, messageId: 'noVar' });
        }
      },
    };
  },
});
