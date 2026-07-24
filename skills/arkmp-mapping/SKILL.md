---
name: arkmp-mapping
description: |
  ArkMP 组件/样式/API 映射查询 skill。当 agent 需要查询 ArkUI 组件如何映射为小程序标签、
  ArkUI 样式如何映射为 WXSS、ArkMP API 如何映射为 wx.* 时，使用本 skill 作为参考。
  本 skill 适用于编写源码时的映射确认、排查转换结果不符预期、了解降级行为等场景。
---

# arkmp-mapping — 组件/样式/API 映射查询

## 1. 原则声明

> **编译期静态转换**：ArkMP 的所有映射都是编译期静态转换，不依赖运行时 VDOM。
> 组件映射为 WXML 标签，样式映射为 WXSS 属性，API 映射为 wx.* 调用。
> 了解映射规则有助于写出可预测的源码，并快速定位转换结果与预期的差异。

## 2. 组件映射

### 2.1 布局容器

ArkUI 布局容器映射为 `<view>` + runtime 基础 class（用 flex 实现容器语义）：

| ArkUI 组件 | WXML 产物 | 基础类 | flex 语义 |
| --- | --- | --- | --- |
| `Column({ space })` | `<view class="arkmp-col">` | `display:flex; flex-direction:column` | 纵向排列 |
| `Row({ space })` | `<view class="arkmp-row">` | `display:flex; flex-direction:row` | 横向排列 |
| `Stack()` | `<view class="arkmp-stack">` | `position:relative` | 子节点 `position:absolute` |
| `Flex({ wrap })` | `<view class="arkmp-flex">` | `display:flex; flex-wrap:wrap` | — |
| `Scroll()` | `<scroll-view scroll-y class="arkmp-scroll">` | — | 纵向滚动 |
| `List()` | `<scroll-view scroll-y enhanced>` | — | 增强列表 |
| `Grid()` | `<view class="arkmp-grid">` | `display:grid` | CSS grid |
| `Swiper()` | `<swiper>` | — | 轮播 |

`space` 参数编译为容器上的 `gap` 样式。

### 2.2 基础组件

| ArkUI | 小程序组件 | 关键属性转换 |
| --- | --- | --- |
| `Text('内容')` | `<text>` | `.fontSize(20)` → `font-size:20rpx` |
| `Image($r('app.media.x'))` | `<image>` | `.objectFit(ImageFit.Cover)` → `mode="aspectFill"` |
| `Button('确定')` | `<view class="arkmp-btn">` | 纯文本按钮编译为 view（runtime 提供按压态样式） |
| `TextInput({ placeholder })` | `<input>` | `onChange` → `bindinput` |
| `TextArea()` | `<textarea>` | 同上 |
| `Toggle({ type: Switch })` | `<switch>` | `onChange` → `bindchange` |
| `Checkbox()` | `<checkbox>` | — |
| `Radio({ value, group })` | `<radio>`（包在 `<radio-group>` 中） | 编译期收集同组 Radio 生成 group 包裹 |
| `Slider()` | `<slider>` | — |
| `Progress()` | `<progress>` | — |
| `Divider()` | `<view class="arkmp-divider">` | — |
| `Blank()` | `<view style="flex:1">` | — |
| `Web()` | `<web-view>` | — |
| `Video()` | `<video>` | — |
| `Canvas()` | `<canvas>` | canvas-id 自动分配 |

### 2.3 Runtime 组件（由 @arkmp/runtime 提供）

| ArkUI | 产物标签 | 说明 |
| --- | --- | --- |
| `LoadingProgress()` | `<view class="arkmp-loading">` | runtime 内置加载组件 |
| `Badge()` | `<view class="arkmp-badge">` | runtime 内置角标组件 |
| `Tabs()` / `TabContent()` | `<arkmp-tabs>` / `<arkmp-tab-content>` | 基于 swiper + 自定义 tab 栏 |

### 2.4 Image objectFit → mode 映射

| ArkUI `ImageFit` | 小程序 `mode` |
| --- | --- |
| `Fill` | `scaleToFill` |
| `Contain` | `aspectFit` |
| `Cover` | `aspectFill` |
| `None` | `center` |
| 单边 + aspectRatio | `widthFix` / `heightFix` |

### 2.5 Button 特殊处理

ArkUI 的 `Button` 可包裹任意子组件，小程序 `<button>` 内嵌有样式限制：

- 纯文本 Button → 编译为 `<view class="arkmp-btn" bindtap="...">`
- 使用了 ArkMP 开放能力封装（如 `ShareButton`）→ 编译为 `<button open-type="share">`

### 2.6 不支持直接映射的组件

| ArkUI 组件 | 处理 | 替代方案 |
| --- | --- | --- |
| `Navigation` / `NavDestination` | 转换为小程序路由 | `router.push` / `router.replace` |
| `Refresh` | 页面级 → `enablePullDownRefresh`；容器级 → runtime | — |
| `WaterFlow` | 降级为双列 List | 用 `ForEach` + 两列布局模拟 |
| `RelativeContainer` | error | 改用 `Column` / `Row` / `Stack` |

## 3. 样式映射

### 3.1 总体策略

```text
.fontSize(20).fontColor('#333')      ──┐
（静态样式：编译期可求值）              ├─→ 提取为 WXSS 类（去重复用）
.width(this.boxWidth)                ──┐
（动态样式：依赖状态）                  └─→ 内联 style="{{...}}"
```

- **静态样式**：提取到 `.wxss`，生成语义化类名，相同样式全工程去重。
- **动态样式**：留在 WXML `style="{{}}"` 属性中，绑定状态字段。

### 3.2 单位换算

编译期统一换算：`vp → rpx`，系数 ×2（750rpx 基准 ≈ 360~375vp 视宽）。系数可通过 `arkmp.config.ts` 的 `compile.unitRatio` 配置。

| ArkUI | WXSS | 规则 |
| --- | --- | --- |
| `.width(100)` / `.height(50)` | `width: 200rpx` | vp 数值 ×2 |
| `.fontSize(16)` | `font-size: 32rpx` | fp 按 vp 同规则换算 |
| `.width('100%')` | `width: 100%` | 百分比原样透传 |
| `.padding(12)` | `padding: 24rpx` | 对象参数 `{ top: 12, left: 16 }` 展开为四值 |
| `.border({ width: 1 })` | `border: 2rpx solid ...` | — |

### 3.3 样式属性白名单

| ArkUI 修饰符 | CSS 属性 | 值类型 |
| --- | --- | --- |
| `.width` / `.height` / `.constraintSize` | `width` / `height` / `max-width`... | length |
| `.padding` / `.margin` | `padding` / `margin` | length（支持单值/对象） |
| `.backgroundColor` | `background-color` | color |
| `.backgroundImage` | `background-image` | string（$r 路径解析） |
| `.borderRadius` | `border-radius` | length |
| `.border` | `border` | special |
| `.fontSize` / `.fontColor` / `.fontWeight` / `.fontStyle` | `font-size` / `color` / `font-weight` / `font-style` | length / color / enum |
| `.textAlign` | `text-align` | enum |
| `.maxLines` + `.textOverflow(Ellipsis)` | `text-overflow` / `-webkit-line-clamp` | 编译期按行数分流 |
| `.opacity` | `opacity` | number |
| `.visibility(Hidden)` | `visibility: hidden` | enum（`None` 改写为条件渲染） |
| `.zIndex` | `z-index` | number |
| `.position({x,y})` | `position:absolute; left/top` | length |
| `.offset` | `transform: translate()` | length |
| `.scale` / `.rotate` | `transform` 组合 | special |
| `.shadow` | `box-shadow` | special（参数近似换算） |
| `.linearGradient` | `background: linear-gradient(...)` | special |
| `.aspectRatio` | `aspect-ratio` | number（低版本降级 padding hack） |
| `.layoutWeight(1)` | `flex: 1` | number（父容器非 Row/Column 时 warning） |
| `.align(Alignment.X)` | `align-self` | enum |

未列入白名单的修饰符：编译期 warning（W4xxx）+ 生成注释 `/* arkmp: unsupported .blur(10) */`，不阻断构建。

### 3.4 布局属性映射

| ArkUI | CSS |
| --- | --- |
| `Column({ space: 12 })` | `gap: 24rpx` |
| `.justifyContent(FlexAlign.SpaceBetween)` | `justify-content: space-between` |
| `.alignItems(HorizontalAlign.Center)`（Column 内） | `align-items: center` |
| `.alignItems(VerticalAlign.Center)`（Row 内） | `align-items: center` |

编译器知道容器轴向（Column=column / Row=row），自动将 `HorizontalAlign`/`VerticalAlign` 落到正确的 flex 属性。

### 3.5 枚举映射表

#### FlexAlign

| ArkUI | CSS |
| --- | --- |
| `Start` | `flex-start` |
| `Center` | `center` |
| `End` | `flex-end` |
| `SpaceBetween` | `space-between` |
| `SpaceAround` | `space-around` |
| `SpaceEvenly` | `space-evenly` |

#### FontWeight

| ArkUI | CSS |
| --- | --- |
| `Normal` | `normal` (400) |
| `Bold` | `bold` (700) |
| `Medium` | `500` |
| `Lighter` | `lighter` (300) |

#### TextAlign

| ArkUI | CSS |
| --- | --- |
| `Start` | `left` |
| `Center` | `center` |
| `End` | `right` |

### 3.6 @Styles / @Extend 处理

- `@Styles` 方法体在编译期**内联展开**到每个调用点，再走正常静态提取（去重后等价于公共类）。产物中不保留 `@Styles` 概念。
- `@Extend(Text)` 带参数的样式函数：参数为字面量时内联展开；参数来自状态时降级为动态样式绑定。

## 4. 状态与生命周期映射

### 4.1 装饰器 → 小程序机制

| ArkUI 装饰器 | 小程序产物 | 说明 |
| --- | --- | --- |
| `@State` | `data` | 直接赋值 → 编译期改写为 `setData` |
| `@Prop` | `properties`（单向） | 父变子随 |
| `@Link` | `properties` + `triggerEvent`（双向） | 赋值自动回写父组件 |
| `@Provide` / `@Consume` | runtime 依赖注入表 | 跨页面降级为 globalData |
| `@Observed` / `@ObjectLink` | runtime 深观察 Proxy | 版本号 + 整体 setData |
| `@Watch` | setData 回调钩子 | 赋值时自动触发 |
| `@StorageLink` | `globalData` + `storage` | 内存态 + 持久化 |

### 4.2 生命周期映射

#### 页面（@Entry）

| ArkUI | 小程序 |
| --- | --- |
| `aboutToAppear()` | `onLoad(options)` |
| `onPageShow()` | `onShow()` |
| `onDidBuild()` | `onReady()` |
| `onPageHide()` | `onHide()` |
| `aboutToDisappear()` | `onUnload()` |

#### 组件（@Component）

| ArkUI | 小程序 lifetimes |
| --- | --- |
| `aboutToAppear()` | `attached` |
| `onDidBuild()` | `ready` |
| `aboutToDisappear()` | `detached` |

## 5. 事件映射

| ArkUI | WXML | 说明 |
| --- | --- | --- |
| `.onClick(fn)` | `bindtap="__nX_click"` | — |
| `.onTouch(fn)` | `bindtouchstart/move/end` | 分发 |
| `.onChange(fn)` | `bindchange` | 值通过 `e.detail.value` 传递 |
| `gesture(TapGesture)` | `bindtap` | 双击编译为 runtime 双击识别 |
| `gesture(LongPressGesture)` | `bindlongpress` | — |
| `gesture(PanGesture)` | runtime 手势模块 | touch 事件序列换算 |

事件回调体抽取为页面/组件方法，命名规则 `__{nodeId}_{event}`，保证稳定可 diff。

## 6. API 映射

### 6.1 路由 API

源码使用 `@arkmp/api` 的 `router` 命名空间（ArkUI Navigation 风格），编译为小程序路由调用：

| 源码 | 产物 |
| --- | --- |
| `router.push({ name: 'Detail', param })` | `wx.navigateTo({ url: '/pages/detail/detail?id=...' })` |
| `router.replace({ name })` | `wx.redirectTo` |
| `router.back()` | `wx.navigateBack()` |
| `router.switchTab({ name })` | `wx.switchTab` |
| `router.relaunch({ name })` | `wx.reLaunch` |
| `router.pop(result)` | `eventChannel.emit` |

param 序列化：简单值拼 query；对象值 `encodeURIComponent(JSON.stringify())`，目标页 onLoad 自动解码。

### 6.2 系统 API

源码使用 `@arkmp/api` 命名空间（仿鸿蒙 kit 风格），全部 Promise 化，编译为 wx.* 调用：

| 源码 API | 产物 | 说明 |
| --- | --- | --- |
| `http.request(url, options)` | `wx.request` | Promise 化包装 |
| `storage.set(key, value)` | `wx.setStorageSync` | 值自动 JSON 序列化 |
| `storage.get(key)` | `wx.getStorageSync` | — |
| `storage.remove(key)` | `wx.removeStorageSync` | — |
| `prompt.showToast({ message })` | `wx.showToast({ title })` | — |
| `prompt.showDialog({ title, message, buttons })` | `wx.showModal` | — |
| `prompt.showActionMenu({ items })` | `wx.showActionSheet` | — |
| `media.pickImage({ count })` | `wx.chooseMedia` | — |
| `media.previewImage(urls, current)` | `wx.previewImage` | — |
| `location.getCurrent()` | `wx.getLocation` | 自动生成 permission 声明 |
| `share.share({ title, path })` | `onShareAppMessage` 配置 | — |
| `auth.login()` | `wx.login` | — |
| `device.getNetworkType()` | `wx.getNetworkType` | — |
| `pay.request(params)` | `wx.requestPayment` | — |

### 6.3 不支持的 API

| 源码 API | 错误码 | 说明 |
| --- | --- | --- |
| `form.createCard` | E3001 | 小程序无服务卡片能力 |
| `distributed.continue` | E3002 | 小程序无跨设备流转能力 |

### 6.4 动画适配

| ArkUI | 产物 |
| --- | --- |
| `.animation({...})` 属性动画 | 静态部分转 CSS `transition`；动态值经 style 绑定 |
| `animateTo({...}, () => {...})` | runtime 序列：先设 transition，再 setData 触发 |
| `transition(TransitionEffect.OPACITY...)` | runtime 进出场组件（view + class 切换） |
| `keyframeAnimateTo` | WXSS `@keyframes` 生成 |

性能原则：只动画 `transform` / `opacity`，动画 `width` / `height` 时 warning。

## 7. 自定义组件引用映射

```ts
// 源码
UserCard({ name: '小明', age: 20 })
```

```html
<!-- 产物（页面 json 自动生成 usingComponents） -->
<user-card name="小明" age="{{20}}" />
```

规则：
- 静态字符串属性直接写字符串字面量
- 其余一律包 `{{}}`
- 回调参数编译为 `bind:change`，组件内部 `triggerEvent`

## 8. @Builder 映射

| 类型 | 产物 |
| --- | --- |
| 无状态 `@Builder`（纯展示片段） | WXML `<template>` + `is` 引用 |
| 有状态交互的 `@Builder` | 编译期提升为独立自定义组件（自动命名 `PageName$builder1`） |

## 9. 样式优先级与隔离

- 页面样式类按"页面名前缀"生成（`.index-xxx`），组件样式带组件名前缀。
- 自定义组件产物 json 设置 `styleIsolation: 'isolated'`，与 ArkUI 组件样式隔离语义一致。
- `app.ets` 中的全局样式 → `app.wxss`。
- `$r('app.color.primary')` → 编译期读取 `resources/base/element/color.json`，生成 CSS 变量。
- 深色资源 `resources/dark/` → 编译为 `@media (prefers-color-scheme: dark)` 块。
