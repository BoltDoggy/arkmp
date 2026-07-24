import { ESLintUtils } from '@typescript-eslint/utils';

/**
 * 规则创建器：docs url 统一指向 08 篇（语法子集与限制），规则条目即该篇的机器可读形式。
 */
export const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/arkmp/arkmp/tree/main/docs/arkui-miniprogram/08-limitations.md#${name}`,
);
