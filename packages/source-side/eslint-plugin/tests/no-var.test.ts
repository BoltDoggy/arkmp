import { noVar } from '../src/rules/no-var.js';
import { ruleTester } from './helpers.js';

ruleTester.run('no-var', noVar, {
  valid: [
    // let / const 不触发
    'let a = 1;',
    'const b = 2;',
    'class A { foo() { let c = 3; } }',
  ],
  invalid: [
    // 顶层 var
    {
      code: 'var x = 1;',
      errors: [{ messageId: 'noVar' }],
    },
    // for(var ...) 初始化中的 var
    {
      code: 'for (var i = 0; i < 10; i++) { i; }',
      errors: [{ messageId: 'noVar' }],
    },
    // 多声明 var
    {
      code: 'var m = 1, n = 2;',
      errors: [{ messageId: 'noVar' }],
    },
    // 组件方法内的 var
    {
      code: 'class A { foo() { var y = 1; } build() { Column(); } }',
      errors: [{ messageId: 'noVar' }],
    },
  ],
});
