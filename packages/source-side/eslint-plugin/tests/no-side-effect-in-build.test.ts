import { noSideEffectInBuild } from '../src/rules/no-side-effect-in-build.js';
import { ruleTester } from './helpers.js';

ruleTester.run('no-side-effect-in-build', noSideEffectInBuild, {
  valid: [
    // build() 内只有 UI 声明
    'class A { build() { Column({ space: 12 }); } }',
    // 事件回调中修改状态（build() 外）
    'class A { onTap() { this.count = 1; } build() { Column(); } }',
    // 生命周期中发请求（build() 外）
    'class A { aboutToAppear() { http.request("/api"); setTimeout(() => {}, 100); } build() { Column(); } }',
    // build() 内的局部变量赋值（非 this）
    'class A { build() { const w = 100; let h = w; h = 200; Column(); } }',
  ],
  invalid: [
    // build() 中修改状态
    {
      code: 'class A { build() { this.count = 1; Column(); } }',
      errors: [{ messageId: 'modifyState' }],
    },
    {
      code: 'class A { build() { this.user.name = "x"; Column(); } }',
      errors: [{ messageId: 'modifyState' }],
    },
    {
      code: 'class A { build() { this.count++; Column(); } }',
      errors: [{ messageId: 'modifyState' }],
    },
    // build() 中定时器 / 请求
    {
      code: 'class A { build() { setInterval(() => {}, 1000); Column(); } }',
      errors: [{ messageId: 'sideEffectCall' }],
    },
    {
      code: 'class A { build() { fetch("/api"); Column(); } }',
      errors: [{ messageId: 'sideEffectCall' }],
    },
    {
      code: 'class A { build() { http.request("/api"); Column(); } }',
      errors: [{ messageId: 'sideEffectCall' }],
    },
  ],
});
