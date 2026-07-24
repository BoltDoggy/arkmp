# 06. 运行时与 API 适配层

本篇定义两部分：随产物注入的 `@arkmp/runtime` 库，以及源码侧 ArkUI/鸿蒙 API 到 `wx.*` 的映射规则。

## @arkmp/runtime 库

产物中每个工程注入一份 `arkmp/runtime.js`（目标 <10KB），职责仅限四块：

```text
runtime
├── createPage(config)       # 页面构造器封装：state 桥接 + 生命周期分发
├── createComponent(config)  # 组件构造器封装：properties/observer/双向绑定
├── state                    # Proxy 状态层、批量 setData 调度、派生字段重算
├── provide/consume          # 跨层级注入表
├── gesture                  # Pan/Pinch 等手势的 touch 序列换算
└── utils                    # 事件参数规范化等
```

### 页面构造示意

```js
// 产物 pages/index/index.js
const { createPage } = require('../../arkmp/runtime.js');

createPage({
  state: {
    count: 0,
    list: []
  },
  derived: {
    __derived_title: ['count', function (s) { return `共 ${s.count} 次`; }]
  },
  methods: {
    __n3_click() {
      this.setData({ count: this.data.count + 1 });   // 编译期改写后的赋值
    },
    aboutToAppear(options) {
      // 用户源码逻辑
    }
  }
});
```

`createPage` 内部：

1. 用 `state` 初始化 `data`；
2. 建立 Proxy 兜底层并把 `this.count = 1` 式写入桥接到批量 setData；
3. 把 `aboutToAppear/onPageShow/...` 挂到 `onLoad/onShow/...`；
4. 每次 setData 后按依赖表重算 derived 字段；
5. 注册 `@Watch` 钩子。

## 路由适配

源码侧使用 ArkUI 的 Navigation 风格 API，编译为小程序路由调用：

| 源码（ArkMP 适配 API） | 产物 |
| --- | --- |
| `router.push({ name: 'Detail', param })` | `wx.navigateTo({ url: '/pages/detail/detail?id=...' })` |
| `router.replace({ name })` | `wx.redirectTo` |
| `router.back()` | `wx.navigateBack()` |
| `router.switchTab({ name })` | `wx.switchTab` |
| `router.relaunch({ name })` | `wx.reLaunch` |

实现要点：

- 路由表在编译期由 `@Entry` 页面收集生成（页面名 → 路径映射），产物中含 `app.json.pages`。
- **param 序列化**：小程序 url 只能带字符串。编译器生成统一编解码：简单值直接拼 query；对象值 `encodeURIComponent(JSON.stringify())`，目标页 onLoad 由 runtime 自动解码还原。
- **回传数据**：`router.push({ ..., onResult })` 编译为 `wx.navigateTo` 的 `events` 参数 + 子页面 runtime 封装的 `router.pop(result)` → `eventChannel.emit`。
- tab 页在源码中用 `router.switchTab` 显式区分，编译期校验 tab 页面集合与 app.json tabBar 一致。

## 系统 API 映射

源码侧提供 `@arkmp/api` 命名空间（仿鸿蒙 kit 风格），编译为 wx.* 调用：

| 源码 API | 产物 |
| --- | --- |
| `http.request(url, options)`（Promise 风格） | `wx.request` Promise 化包装 |
| `storage.set/get/remove(key, value)` | `wx.setStorageSync` 等（值自动 JSON 序列化） |
| `prompt.showToast({ message })` | `wx.showToast({ title })` |
| `prompt.showDialog({ title, message, buttons })` | `wx.showModal` |
| `prompt.showActionMenu({ items })` | `wx.showActionSheet` |
| `media.pickImage({ count })` | `wx.chooseMedia` |
| `media.previewImage(urls, current)` | `wx.previewImage` |
| `location.getCurrent()` | `wx.getLocation` |
| `share.share({ title, path })` | 编译为页面 `onShareAppMessage` 配置 + button open-type 提示 |
| `auth.login()` | `wx.login` |
| `device.getNetworkType()` | `wx.getNetworkType` |
| `pay.request(params)` | `wx.requestPayment` |

统一约定：

- **全部 Promise 化**：源码侧 API 均为 async 风格，产物由 runtime 把 wx 回调风格包装为 Promise。
- **错误模型对齐**：`fail` 回调统一转为 reject，错误对象含 `code`/`message`，与鸿蒙 BusinessError 结构对齐。
- **权限声明**：用到定位等权限时，编译器自动在产物 app.json 中生成 `permission` 字段（描述文案取自编译配置）。

## 平台能力缺失的处理

源码调用了小程序不存在的能力（如卡片、跨设备流转）时：

1. 编译期报 E3xxx 错误，列出能力名与替代建议；
2. 如属可降级能力（如某些动画曲线），编译期 warning 并选择最接近的实现。

## 动画适配

| ArkUI | 产物 |
| --- | --- |
| `.animation({...})` 属性动画 | 静态部分转 CSS `transition`；动态值变化经 style 绑定 + transition 完成 |
| `animateTo({...}, () => {...})` | runtime 序列：先设置 transition，再 setData 触发样式变化 |
| `transition(TransitionEffect.OPACITY...)` | runtime 进出场组件（包裹 view + class 切换） |
| `geometryTransition` 共享元素 | 不支持，编译期 warning + 降级为无动画 |
| `keyframeAnimateTo` | WXSS `@keyframes` 生成 |

性能原则保留：只动画 transform/opacity，动画 width/height 时编译期 warning。
