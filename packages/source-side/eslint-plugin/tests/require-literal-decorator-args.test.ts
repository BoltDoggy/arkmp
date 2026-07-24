import { requireLiteralDecoratorArgs } from '../src/rules/require-literal-decorator-args.js';
import { ruleTester } from './helpers.js';

ruleTester.run('require-literal-decorator-args', requireLiteralDecoratorArgs, {
  valid: [
    // 字符串字面量参数
    'class A { @Watch("count") onCountChange() {} }',
    'class A { @StorageLink("userToken") token = ""; }',
    // 无参装饰器不受本规则约束
    'class A { @State count = 0; @Builder content() {} }',
  ],
  invalid: [
    // 变量 / 表达式参数：编译期无法静态求值
    {
      code: 'class A { @Watch(propName) onChange() {} }',
      errors: [{ messageId: 'nonLiteralArg' }],
    },
    {
      code: 'class A { @StorageLink(42) token = ""; }',
      errors: [{ messageId: 'nonLiteralArg' }],
    },
    {
      code: 'class A { @Watch(`count`) onChange() {} }',
      errors: [{ messageId: 'nonLiteralArg' }],
    },
    // 缺参
    {
      code: 'class A { @Watch() onChange() {} }',
      errors: [{ messageId: 'missingArg' }],
    },
  ],
});
