import { noUnknownDecorator } from '../src/rules/no-unknown-decorator.js';
import { ruleTester } from './helpers.js';

ruleTester.run('no-unknown-decorator', noUnknownDecorator, {
  valid: [
    // 08 篇白名单内：类装饰器
    '@Entry\n@Component\nclass IndexPage {}',
    // 白名单内：属性 / 方法装饰器（含带参形式）
    'class A { @State count = 0; @Prop name = ""; @Watch("count") onChange() {} }',
    'class A { @StorageLink("token") token = ""; @Builder content() {} }',
    '@Observed class Model {}',
    'class A { @ObjectLink user; @Provide theme = ""; @Consume locale = ""; @Link show = false; }',
  ],
  invalid: [
    {
      code: '@Injectable\nclass Service {}',
      errors: [{ messageId: 'unknownDecorator' }],
    },
    {
      code: 'class A { @Autowired repo = null; }',
      errors: [{ messageId: 'unknownDecorator' }],
    },
    // 表达式形式装饰器无法静态识别，同样拒绝
    {
      code: 'class A { @deco.make() x = 0; }',
      errors: [{ messageId: 'unknownDecorator' }],
    },
  ],
});
