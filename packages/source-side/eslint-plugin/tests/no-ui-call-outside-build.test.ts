import { noUiCallOutsideBuild } from '../src/rules/no-ui-call-outside-build.js';
import { ruleTester } from './helpers.js';

ruleTester.run('no-ui-call-outside-build', noUiCallOutsideBuild, {
  valid: [
    // build() 内的组件调用
    'class A { build() { Column({ space: 12 }); } }',
    // @Builder 方法内的组件调用
    'class A { @Builder tab() { Text("t"); } build() { Column(); } }',
    // ForEach 循环体（箭头函数为透明层）
    'class A { build() { ForEach(this.list, (item) => { Text(item); }); } }',
    // 普通方法中的非 UI 调用
    'class A { load() { fetch("/api"); } build() { Column(); } }',
    // 非组件名的普通函数调用不受限
    'function util() { format("x"); }',
  ],
  invalid: [
    // 普通函数中的 UI 调用
    {
      code: 'function helper() { Text("x"); }',
      errors: [{ messageId: 'uiCallOutsideBuild' }],
    },
    // 类的普通方法中的 UI 调用
    {
      code: 'class A { render() { Button("ok"); } build() { Column(); } }',
      errors: [{ messageId: 'uiCallOutsideBuild' }],
    },
    // 模块顶层的 UI 调用
    {
      code: 'Text("top");',
      errors: [{ messageId: 'uiCallOutsideBuild' }],
    },
    // build() 外的方法里嵌套闭包中的 UI 调用
    {
      code: 'class A { init() { [1].forEach(() => { Image("a.png"); }); } build() { Column(); } }',
      errors: [{ messageId: 'uiCallOutsideBuild' }],
    },
  ],
});
