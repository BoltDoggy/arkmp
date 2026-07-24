import { createRule } from '../create-rule.js';
import { getCallName, isInBuilderContext, UI_COMPONENTS } from '../utils.js';

type MessageIds = 'uiCallOutsideBuild';

/**
 * no-ui-call-outside-build：UI 组件调用只能出现在 build() 或 @Builder 函数内。
 * 对应 08 篇"build() 约束"第 2 条（组件声明必须静态可枚举）与 03 篇组件清单。
 */
export const noUiCallOutsideBuild = createRule<[], MessageIds>({
  name: 'no-ui-call-outside-build',
  meta: {
    type: 'problem',
    docs: {
      description: '禁止在 build() / @Builder 之外调用 UI 组件（08 篇 build() 约束）',
    },
    messages: {
      uiCallOutsideBuild:
        '{{name}}() 是 UI 组件调用，只能出现在 build() 或 @Builder 函数内（组件声明必须静态可枚举，08 篇）',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return {
      CallExpression(node) {
        const name = getCallName(node);
        if (name !== null && UI_COMPONENTS.has(name) && !isInBuilderContext(node)) {
          context.report({ node, messageId: 'uiCallOutsideBuild', data: { name } });
        }
      },
    };
  },
});
