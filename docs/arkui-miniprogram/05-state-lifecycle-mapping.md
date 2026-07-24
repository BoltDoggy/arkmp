# 05. 状态与生命周期转换

状态转换是 ArkMP 最核心的设计点：ArkUI 里"直接赋值即刷新"的心智模型，在小程序侧必须落到 setData。本篇定义编译期改写与运行时桥接的组合方案。

## 总体方案：编译期改写为主，运行时 Proxy 兜底

```text
@State count: number = 0;
this.count++;                       // 源码（ArkUI 写法）

              编译期改写（能静态分析的赋值）
              ─────────────────────────────
              this.setData({ count: this.data.count + 1 })

              运行时兜底（动态路径、跨函数传递引用等）
              ─────────────────────────────
              Proxy 包装 data，写入时自动批量 setData
```

### 编译期改写（覆盖 90% 场景）

analyze 阶段已为每个 `@State` 字段建表，transform 阶段扫描组件方法体内的赋值表达式：

| 源码写法 | 改写产物 |
| --- | --- |
| `this.count = 1` | `this.setData({ count: 1 })` |
| `this.count++` | `this.setData({ count: this.data.count + 1 })` |
| `this.count += 2` | `this.setData({ count: this.data.count + 2 })` |
| `this.list = [...this.list, 4]` | `this.setData({ list: [...this.data.list, 4] })` |
| `this.user.name = 'x'` | `this.setData({ 'user.name': 'x' })` |
| `this.list[0] = 9` | `this.setData({ 'list[0]': 9 })` |

同一函数内多处连续赋值合并为一次 setData 调用（保持小程序性能最佳实践）。

### 运行时兜底

以下情况编译期无法安全改写，交给 runtime 的 Proxy 层：

- 状态引用被传递给其他函数并在其中修改（`helper(this.user)` 内部改字段）；
- 通过动态键访问（`this[key] = v`）；
- 在异步回调深层闭包中修改且分析无法追踪。

runtime 做法（简化）：

```js
// @arkmp/runtime 核心逻辑
function wrapState(page, stateDef) {
  return new Proxy(stateDef, {
    set(target, key, value) {
      target[key] = value;
      page.setData({ [key]: wrapValue(value) });   // 批量调度合并
      return true;
    }
  });
}
```

Proxy 层带批量调度：同一 tick 内多次写入合并为一次 setData。

> 原则：Proxy 是安全网，不是主路径。编译期改写失败的场景会输出 warning（W2xxx），鼓励开发者改写为可静态分析的模式。

## 各装饰器转换规则

### @State → data

```ts
@State count: number = 0;
@State list: Item[] = [];
```

```js
data: { count: 0, list: [] }
```

初始值须为编译期可序列化的字面量表达式；调用构造函数的初始值（如 `new Task('x')`）在 runtime 初始化阶段执行。

### 普通成员变量 → data（非响应式初始值）

```ts
@Component
struct UserCard {
  name: string = '张三';   // 无装饰器 → 普通成员
  build() { Text(this.name) }
}
```

```js
// 产物（JS）
createComponent({
  data: { name: '张三' },   // 独立 data 段，不进 state
});
```

无装饰器的成员变量不参与响应式追踪（赋值后不自动触发刷新），但其初始值需要进入小程序 `data`，否则 WXML `{{name}}` 绑定读不到值。编译器将其初始值输出到独立的 `data` 段（与 `state` 区分），runtime 透传给小程序框架。`attachState` 只为 `state` 段字段安装访问器，`data` 段字段保持普通属性——与 ArkUI「无装饰器 = 非响应式」的语义一致。

与 `@State` 的关键区别：

| 行为 | `@State count = 0` | `name: string = 'x'`（普通成员） |
| --- | --- | --- |
| 初始值进 `data` | ✓（经 `state` → runtime 展开） | ✓（直接进 `data`） |
| WXML `{{}}` 绑定可读 | ✓ | ✓ |
| `this.xxx = v` 触发刷新 | ✓（编译期改写 `__set` + runtime 访问器） | ✗（普通属性，不触发 setData） |
| `@Watch` 支持 | ✓ | ✗ |

### @Prop → properties（单向）

```ts
// 源码（子组件）
@Prop value: number;
```

```js
// 产物
properties: {
  value: { type: Number, value: 0 }
}
```

父组件 `Child({ value: this.count })` 编译为 `<child value="{{count}}" />`，父变子随（properties 自动更新），语义与 @Prop 一致。

### @Link → properties + triggerEvent（双向）

小程序没有双向绑定，用"属性下发 + 事件回传"组合模拟：

```ts
// 源码（子组件）
@Link isOn: boolean;
// 使用：this.isOn = true;
```

```js
// 产物（子组件 js）
properties: { isOn: Boolean },
methods: {
  __set_isOn(v) {
    this.setData({ isOn: v });
    this.triggerEvent('update:ison', v);   // 回写父组件
  }
}
```

```html
<!-- 产物（父组件 wxml） -->
<child isOn="{{masterSwitch}}" bind:update:ison="__sync_masterSwitch" />
```

```js
// 父组件 js：由编译器生成的同步方法
__sync_masterSwitch(e) {
  this.setData({ masterSwitch: e.detail });
}
```

编译期把子组件内对 `@Link` 字段的赋值改写为 `__set_xxx` 调用，保证双向语义。

### @Provide / @Consume

编译为 runtime 的依赖注入表：页面根上维护 provide 注册表，`@Consume` 组件 attached 时向上查找并订阅，更新通过事件总线 + setData 分发。跨页面共享降级为全局 store（见下）。

### @Observed / @ObjectLink

编译为带版本号的深观察：runtime 对 `@Observed` 类实例做 Proxy 递归包装，属性写入时触发持有它的 `@State` 整体 setData（路径定位到最近的状态根）。深观察成本高，产物会带 warning 提示尽量用扁平状态。

### @Watch → observer / 桥接钩子

```ts
@State @Watch('onCountChange') count: number = 0;
```

编译期改写赋值时在 setData 回调中调用 `onCountChange`；Proxy 兜底路径在 set trap 中同步调用。保证两种路径下 @Watch 都会触发。

### 全局状态：AppStorage → globalData + storage

`AppStorage.setOrCreate('token', v)` / `@StorageLink('token')` 编译为：

```js
// app.js globalData + runtime 订阅
getApp().globalData.token = v;       // 内存态
wx.setStorageSync('token', v);       // 持久化（标注 persist 时）
```

订阅 `@StorageLink` 的组件由 runtime 在 setData 桥接层统一刷新。

## 计算表达式（WXML 能力外）

`Text(this.format(this.price))` 这类含方法调用的绑定，编译为"派生字段"：

```js
// runtime 在每次 price 变化后重算并 setData
data: { price: 99, __derived_price_text: '¥99.00' }
```

```html
<text>{{__derived_price_text}}</text>
```

派生依赖图在 analyze 阶段构建（`__derived_price_text` 依赖 `price`），setData 改写器在更新依赖字段后自动重算。

## 生命周期映射

ArkMP 同时支持 **ArkUI 命名**（推荐）与 **小程序原生命名**。两套命名无重名冲突（ArkUI 名如 `aboutToAppear`/`onPageShow` 与原生名如 `onLoad`/`onShow` 零交集），可以安全共存。

- ArkUI 命名钩子经 analyzer 识别后存入 `model.lifecycle`，由 transform-js 按固定顺序输出，再由 runtime 映射到小程序钩子。
- 小程序原生命名钩子经 analyzer 归入 `model.methods`（保留原始参数名），由 runtime 恒等映射（页面）或恒等映射到 `lifetimes` 块（组件），从而同时支持两套命名。

推荐统一使用 ArkUI 命名以保持与 ArkUI 源码的一致性。`@arkmp/types` 对原生命名标注了 `@deprecated` JSDoc 以在 IDE 中提示。

### 页面（@Entry）

| ArkUI 命名（推荐） | 小程序原生命名 | 小程序产物钩子 |
| --- | --- | --- |
| `aboutToAppear(options)` | `onLoad(query)` | `onLoad`（路由参数注入为 options/query） |
| `onPageShow()` | `onShow()` | `onShow` |
| `onDidBuild()` | `onReady()` | `onReady` |
| `onPageHide()` | `onHide()` | `onHide` |
| `aboutToDisappear()` | `onUnload()` | `onUnload` |
| `onPullRefresh()` | `onPullDownRefresh()` | `onPullDownRefresh`（+ 自动 `wx.stopPullDownRefresh()`） |
| `onBackPress()` | — | 无对应：编译期 warning；返回值 true 的场景提示改用交互弹窗 |

无 ArkUI 对应的小程序原生页面钩子（`onReachBottom`、`onShareAppMessage`、`onPageScroll`、`onResize`、`onTabItemTap`、`onShareTimeline`、`onAddToFavorites`）可直接使用原生命名，runtime 透传到 Page config。

### 组件（@Component）

| ArkUI 命名（推荐） | 小程序原生命名 | 小程序 lifetimes |
| --- | --- | --- |
| `aboutToAppear()` | `attached()` | `attached` |
| `onDidBuild()` | `ready()` | `ready` |
| `aboutToDisappear()` | `detached()` | `detached` |
| — | `created()` | `created`（组件实例创建时，早于 attached） |
| — | `moved()` | `moved` |

### 应用（@Entry 所在的 Ability 概念）

ArkMP 约定用 `app.ets` 表达应用级逻辑：

```ts
// app.ets（ArkMP 约定的源码结构）
export default class App {
  onLaunch(options: LaunchOptions): void { /* ... */ }
  onShow(): void {}
  onHide(): void {}
}
```

编译为小程序 `App({ onLaunch, onShow, onHide })`。

### 页面行为配置

| ArkUI 侧表达 | 小程序产物 |
| --- | --- |
| `@Entry({ title: '首页', pullRefresh: true })` | 页面 json：`navigationBarTitleText`、`enablePullDownRefresh` |
| 下拉刷新回调约定方法 `onPullRefresh()` / `onPullDownRefresh()` | `onPullDownRefresh()` + 自动 `wx.stopPullDownRefresh()` |
| `List.onReachEnd()` | 页面级编译为 `onReachBottom`；scroll-view 内编译为 `bindscrolltolower` |
