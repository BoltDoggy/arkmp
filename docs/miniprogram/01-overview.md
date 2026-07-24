# 01. 小程序概述

## 什么是微信小程序

微信小程序是一种运行在微信内的应用形态，无需下载安装，扫一扫或搜索即可使用。特点：

- **免安装、轻量**：主包体积限制 2MB（整包含分包不超过 30MB，单分包不超过 2MB，具体以最新官方限制为准）。
- **双线程架构**：逻辑层与渲染层分离，由微信客户端 Native 中转通信。
- **能力受限但丰富**：不能直接操作 DOM，但微信提供了网络、支付、位置、媒体等大量原生能力 API。

## 双线程模型

```text
┌─────────────────────────────────────────────┐
│  逻辑层（App Service）                        │
│  · 运行 JavaScript（Page / App 逻辑）          │
│  · JSCore / V8 环境，无 window / document     │
├────────────── Native 中转 ──────────────────┤
│  渲染层（View）                               │
│  · 运行 WXML / WXSS（WebView 渲染）            │
│  · 每个页面对应一个 WebView                    │
└─────────────────────────────────────────────┘
```

- 逻辑层调用 `setData()` 时，数据经 Native 序列化传到渲染层更新视图——这是小程序性能的关键点：**setData 传输有成本，要控制数据量与频率**。
- 两个线程无法直接互相访问，渲染层的节点信息需通过 `wx.createSelectorQuery()` 查询。

## 开发工具与流程

1. 注册小程序账号（https://mp.weixin.qq.com），获取 AppID。
2. 安装微信开发者工具，新建项目（填 AppID，或用测试号）。
3. 编写代码 → 工具内预览/真机预览 → 上传 → 提交审核 → 发布。

### 常用调试功能

- 模拟器（多机型/网络模拟）、真机调试、体验评分
- AppData 面板（实时查看页面 data）
- 性能面板（Trace）、Audits 体验评分
- 编译模式（指定启动页面与参数，方便开发深层页面）

## 最小可运行示例

```text
miniprogram/
├── app.js
├── app.json
├── app.wxss
└── pages/
    └── index/
        ├── index.js
        ├── index.json
        ├── index.wxml
        └── index.wxss
```

```js
// app.js
App({
  onLaunch() {
    console.log('小程序启动');
  }
});
```

```json
// app.json
{
  "pages": ["pages/index/index"],
  "window": {
    "navigationBarTitleText": "我的小程序"
  }
}
```

```html
<!-- pages/index/index.wxml -->
<view class="container">
  <text>{{message}}</text>
  <button bindtap="onTap">点击 +1，当前 {{count}}</button>
</view>
```

```js
// pages/index/index.js
Page({
  data: {
    message: 'Hello 小程序',
    count: 0
  },
  onTap() {
    this.setData({ count: this.data.count + 1 });
  }
});
```

## 概念对照

| 概念 | 小程序 | Web |
| --- | --- | --- |
| 视图描述 | WXML | HTML |
| 样式 | WXSS（rpx 单位） | CSS |
| 逻辑 | Page()/App() 构造器 | 直接操作 DOM |
| 数据更新 | this.setData() | 直接修改 DOM |
| 路由 | wx.navigateTo 等 API | history / location |
