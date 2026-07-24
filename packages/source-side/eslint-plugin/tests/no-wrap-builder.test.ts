import { noWrapBuilder } from '../src/rules/no-wrap-builder.js';
import { ruleTester } from './helpers.js';

ruleTester.run('no-wrap-builder', noWrapBuilder, {
  valid: [
    // 普通 @Builder 是支持的（03 篇：编译为 template 或提升为组件）
    'class A { @Builder content() { Text("x"); } build() { Column(); } }',
    'class A { @Builder header() { Row(); } build() { Column(); } }',
  ],
  invalid: [
    // E1005：wrapBuilder 动态组件
    {
      code: 'const wrapped = wrapBuilder(buildFn);',
      errors: [{ messageId: 'wrapBuilder' }],
    },
    // E1005：@LocalBuilder 高阶用法
    {
      code: 'class A { @LocalBuilder local() { Text("x"); } build() { Column(); } }',
      errors: [{ messageId: 'localBuilder' }],
    },
  ],
});
