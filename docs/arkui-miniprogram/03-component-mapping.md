# 03. 组件转换规则

本篇定义编译器如何把 ArkUI 组件树翻译为 WXML。所有映射都是**编译期静态转换**，不依赖运行时。

## 布局容器：映射为 view + 基础类

ArkUI 布局容器没有直接对应的小程序组件，统一编译为 `<view>` + runtime 基础 class（用 flex 实现容器语义）：

| ArkUI 组件 | WXML 产物 | runtime 基础类 |
| --- | --- | --- |
| `Column({ space })` | `<view class="arkmp-col">` | `display:flex; flex-direction:column; box-sizing:border-box` |
| `Row({ space })` | `<view class="arkmp-row">` | `display:flex; flex-direction:row; box-sizing:border-box` |
| `Stack()` | `<view class="arkmp-stack">` | `position:relative`，子节点 `position:absolute` |
| `Flex({ wrap })` | `<view class="arkmp-flex">` | `display:flex; flex-wrap:wrap` |
| `Scroll()` | `<scroll-view scroll-y class="arkmp-scroll">` | — |
| `List()` | `<scroll-view scroll-y enhanced>` | — |
| `Grid()` | `<view class="arkmp-grid">`（CSS grid） | `display:grid` |
| `Swiper()` | `<swiper>` | — |

`space` 参数编译为容器上的 `gap` 样式；`justifyContent` / `alignItems` 编译为对应 flex 属性（见 04 篇）。

## 基础组件映射表

| ArkUI | 小程序组件 | 属性转换 |
| --- | --- | --- |
| `Text('内容')` | `<text>` | `.fontSize(20)` → `style="font-size:20rpx"`（换算见 04 篇） |
| `Image($r('app.media.x'))` | `<image>` | `.objectFit(ImageFit.Cover)` → `mode="aspectFill"` |
| `Button('确定')` | `<view class="arkmp-btn">` 或 `<button>` | 见下文"Button 的特殊处理" |
| `TextInput({ placeholder })` | `<input>` | `onChange` → `bindinput` |
| `TextArea()` | `<textarea>` | 同上 |
| `Toggle({ type: Switch })` | `<switch>` | `onChange` → `bindchange` |
| `Checkbox()` | `<checkbox>` | — |
| `Radio({ value, group })` | `<radio>`（包在 `<radio-group>` 中） | 编译期收集同组 Radio 生成 group 包裹 |
| `Slider()` | `<slider>` | — |
| `Progress()` | `<progress>` | — |
| `LoadingProgress()` | runtime 内置加载组件 | — |
| `Divider()` | `<view class="arkmp-divider">` | — |
| `Blank()` | `<view style="flex:1">` | — |
| `Badge()` | runtime 内置角标组件 | — |
| `Tabs()` / `TabContent()` | runtime Tabs 组件（基于 swiper + 自定义 tab 栏） | — |
| `Web()` | `<web-view>` | — |
| `Video()` | `<video>` | — |
| `Canvas()` | `<canvas>` | canvas-id 自动分配 |

### Image 的 objectFit → mode

| ArkUI `ImageFit` | 小程序 `mode` |
| --- | --- |
| `Fill` | `scaleToFill` |
| `Contain` | `aspectFit` |
| `Cover` | `aspectFill` |
| `None` | `center` |
| 单边 + aspectRatio | `widthFix` / `heightFix` |

### Button 的特殊处理

ArkUI 的 `Button` 可包裹任意子组件（`Button() { Image(...) }`），而小程序 `<button>` 内嵌内容有样式限制。转换规则：

- 纯文本 Button → 编译为 `<view class="arkmp-btn" bindtap="...">`（runtime 提供按压态样式）。
- 当源码使用了 ArkMP 提供的开放能力封装（如 `ShareButton` 适配组件）→ 编译为真正的 `<button open-type="share">`。

## 控制流翻译

### if / else → wx:if

```ts
if (this.isLoading) {
  LoadingProgress()
} else {
  Text('加载完成')
}
```

```html
<view wx:if="{{isLoading}}" class="arkmp-loading"></view>
<text wx:else>加载完成</text>
```

### ForEach → wx:for

```ts
ForEach(this.items, (item: Item) => {
  Text(item.title)
}, (item: Item) => item.id)
```

```html
<text wx:for="{{items}}" wx:for-item="item" wx:key="id">{{item.title}}</text>
```

转换要点：

- 键生成函数 `(item) => item.id` 编译为 `wx:key="id"`；`(item) => item` 编译为 `wx:key="*this"`；缺失时编译期 warning 并回退 `wx:key="index"`。
- 循环体内的局部变量名直接沿用源码参数名，嵌套 ForEach 时自动改写 `wx:for-item` / `wx:for-index` 避免冲突。
- `LazyForEach` 降级为 `ForEach` + warning（小程序侧由 scroll-view 分页模拟，见 08 篇）。

## 状态绑定表达式

build() 中依赖状态的表达式编译为 `{{}}` 插值：

```ts
Text(`点击次数：${this.count}`)           →  <text>点击次数：{{count}}</text>
Text(this.user.name)                      →  <text>{{user.name}}</text>
Image(this.avatar)                        →  <image src="{{avatar}}" />
Text(this.isVip ? '会员' : '游客')          →  <text>{{isVip ? '会员' : '游客'}}</text>
```

模板字符串中的 `this.xxx` 提取为绑定字段；支持 WXML 表达式子集内的三元、算术、比较运算。超出 WXML 表达式能力的（如方法调用 `this.format(price)`）编译为 runtime 计算属性：在 data 桥接层预计算 `formatted_price` 字段（见 05 篇）。

## 事件绑定

| ArkUI | WXML |
| --- | --- |
| `.onClick(fn)` | `bindtap="__nX_click"` |
| `.onTouch(fn)` | `bindtouchstart/move/end` 分发 |
| `.onChange(fn)` | `bindchange`（值通过 `e.detail.value` 传递，与 ArkUI 回调参数对齐） |
| `gesture(TapGesture)` | `bindtap`（双击编译为 runtime 双击识别） |
| `gesture(LongPressGesture)` | `bindlongpress` |
| `gesture(PanGesture)` | runtime 手势模块（touch 事件序列换算） |

事件回调体抽取为页面/组件方法，命名规则 `__{nodeId}_{event}`，保证稳定可 diff。

## 自定义组件引用

```ts
// 静态 props
UserCard({ name: '小明', age: 20 })

// 动态 props（含状态绑定）
StatusTag({ status: this.status })

// 混合
Counter({ label: '计数', count: this.count })
```

```html
<!-- 页面 json 自动生成 usingComponents -->
<user-card name="小明" age="{{20}}" />
<status-tag status="{{status}}" />
<counter label="计数" count="{{count}}" />
```

- 静态字符串属性直接写字符串字面量；其余一律包 `{{}}`。
- 构造参数为对象字面量时，逐属性拆分为 WXML 属性绑定（保留 key→value 结构）。
- 回调参数（如 `onChange: (v) => {...}`）编译为 `bind:change`，组件内部 `triggerEvent`（见 05 篇）。

## @Builder → template / 组件抽取

- 无状态 `@Builder`（纯展示片段）→ 编译为 WXML `<template>` + `is` 引用。
- 有状态交互的 `@Builder` → 编译期提升为独立自定义组件（自动命名 `PageName$builder1`），走标准组件产物。

## 暂不支持直接映射的 ArkUI 组件

`Navigation`/`NavDestination`、`Refresh`、`WaterFlow`、`RelativeContainer` 等。处理策略：

- `Refresh` → 页面 json `enablePullDownRefresh` + `onPullDownRefresh`（页面级下拉时），或 runtime 自绘（容器级下拉）。
- `Navigation` → 编译为小程序路由（见 06 篇），`NavDestination` 子页面编译为独立页面。
- 其余编译期报错 E1xxx，给出替代写法（见 08 篇）。
