import { noDegradedCapability } from '../src/rules/no-degraded-capability.js';
import { ruleTester } from './helpers.js';

ruleTester.run('no-degraded-capability', noDegradedCapability, {
  valid: [
    'class A { build() { List(); Grid(); } }',
    'class A { onBack() { history.back(); } }',
  ],
  invalid: [
    // 08 篇组件能力表：WaterFlow 降级为双列 List 模拟（warning）
    {
      code: 'class A { build() { WaterFlow(); } }',
      errors: [{ messageId: 'waterFlow' }],
    },
    // 08 篇组件能力表：onBackPress 拦截降级（warning）
    {
      code: 'class A { onBackPress() { return true; } build() { Column(); } }',
      errors: [{ messageId: 'onBackPress' }],
    },
  ],
});
