import { noMiniprogramApi } from '../src/rules/no-miniprogram-api.js';
import { ruleTester } from './helpers.js';

ruleTester.run('no-miniprogram-api', noMiniprogramApi, {
  valid: [
    // 直接状态访问（推荐写法，08 篇）
    'class A { onTap() { this.count = 1; console.log(this.user.name); } }',
    // 源码侧 API 命名空间（06 篇）
    'class A { load() { http.request("/api"); prompt.showToast({ message: "ok" }); } }',
    // 普通成员访问
    'function f(wx2) { return wx2.request; }',
  ],
  invalid: [
    // E3xxx：直接调用 wx.*
    {
      code: 'class A { load() { wx.request({ url: "/api" }); } }',
      errors: [{ messageId: 'wxApi' }],
    },
    {
      code: 'wx.setStorageSync("k", 1);',
      errors: [{ messageId: 'wxApi' }],
    },
    // E3xxx：直接 setData
    {
      code: 'class A { onTap() { setData({ count: 1 }); } }',
      errors: [{ messageId: 'setData' }],
    },
    // E3xxx：访问编译产物概念 this.data
    {
      code: 'class A { onTap() { console.log(this.data.count); } }',
      errors: [{ messageId: 'thisData' }],
    },
    {
      code: 'class A { onTap() { this.data.count = 1; } }',
      errors: [{ messageId: 'thisData' }],
    },
  ],
});
