import { noUnsupportedComponent } from '../src/rules/no-unsupported-component.js';
import { ruleTester } from './helpers.js';

ruleTester.run('no-unsupported-component', noUnsupportedComponent, {
  valid: [
    'class A { build() { Column(); } }',
    'class A { build() { Stack(); Row(); } }',
  ],
  invalid: [
    // 08 篇组件能力表：RelativeContainer 为 error 级
    {
      code: 'class A { build() { RelativeContainer(); } }',
      errors: [{ messageId: 'unsupportedComponent' }],
    },
    {
      code: 'RelativeContainer();',
      errors: [{ messageId: 'unsupportedComponent' }],
    },
  ],
});
