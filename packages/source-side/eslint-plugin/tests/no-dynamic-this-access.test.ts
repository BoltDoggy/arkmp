import { noDynamicThisAccess } from '../src/rules/no-dynamic-this-access.js';
import { ruleTester } from './helpers.js';

ruleTester.run('no-dynamic-this-access', noDynamicThisAccess, {
  valid: [
    // 推荐的静态写法（08 篇）
    'class A { onTap() { this.count = 1; this.user.name = "x"; } }',
    // 字面量键可静态改写
    'class A { onTap() { this["count"] = 1; } }',
    // 非 this 的动态访问不受限
    'function f(obj, key) { return obj[key]; }',
  ],
  invalid: [
    // W2001：非常量键
    {
      code: 'class A { onTap(key) { this[key] = 1; } }',
      errors: [{ messageId: 'dynamicThisAccess' }],
    },
    {
      code: 'class A { onTap(key) { return this[key]; } }',
      errors: [{ messageId: 'dynamicThisAccess' }],
    },
    {
      code: 'class A { onTap() { const k = "count"; this[k]++; } }',
      errors: [{ messageId: 'dynamicThisAccess' }],
    },
  ],
});
