import * as parser from '@typescript-eslint/parser';
import { RuleTester } from '@typescript-eslint/rule-tester';
import { afterAll, describe, it } from 'vitest';

// @typescript-eslint/rule-tester 默认查找全局 describe/it/afterAll；
// vitest 未开 globals，这里显式接线以获得逐用例报告。
RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

export const ruleTester = new RuleTester({
  languageOptions: { parser },
});
