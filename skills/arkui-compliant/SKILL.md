---
name: arkui-compliant
description: |
  ArkUI 语法合规编写 skill。当 agent 协助使用方编写或审查 ArkMP 源码（.ets 文件）时，
  必须确保代码在 ArkMP 可编译子集内。本 skill 涵盖支持的语言特性、不支持特性、
  build() 约束、状态写法约束及平台限制。
  本 skill 适用于编写 ArkUI 页面/组件代码、排查语法越界、优化写法以避免降级等任务。
---

# arkui-compliant — ArkUI 语法合规编写

## 1. 原则声明

> **可编译子集**：ArkMP 的输入是 ArkTS/ArkUI 的可编译子集——比完整 ArkTS 窄（去掉无法映射
> 到小程序的能力），但保证是合法 ArkUI。同一份源码可以被 DevEco Studio 正常检查。
> 越界写法一律编译期诊断，不做"猜着转"。

Agent 编写或审查 ArkMP 源码时，必须确保：

1. 只使用 ArkMP 支持的语言特性、装饰器、控制流；
2. 不使用编译期 error 级别的特性；
3. 状态写法可被编译期精确改写（避免落入 Proxy 兜底）；
4. 遵守 build() 约束；
5. 知晓小程序平台的天花板。

## 2. 支持的语言特性

| 类别 | 支持 | 说明 |
| --- | --- | --- |
| 类型系统 | 接口、类型别名、枚举、泛型函数 | 编译产物为 JS，类型擦除 |
| 装饰器 | `@Entry` / `@Component` / `@State` / `@Prop` / `@Link` / `@Provide` / `@Consume` / `@Observed` / `@ObjectLink` / `@Watch` / `@Builder` / `@Styles` / `@Extend` / `@StorageLink` | 转换规则见 05 篇 |
| 控制流 | `if`/`else`、`ForEach`（含嵌套）、三元表达式 | 见 03 篇 |
| 异步 | `async`/`await`、`Promise` | 产物基础库 2.10+ 均支持 |
| 模块化 | `import`/`export` | 编译为 CommonJS |

## 3. 不支持的语言特性（编译期 error）

| 特性 | 原因 | 错误码 | 替代方案 |
| --- | --- | --- | --- |
| `LazyForEach` + IDataSource | 小程序无等价懒加载协议 | E1001 | 用 `ForEach` + scroll-view 分页 |
| `animateTo` 闭包外的动画编排、`keyframeAnimateTo` 复杂编排 | WXML 无法精确表达 | E1002 | 用 CSS transition / @keyframes |
| `geometryTransition` 共享元素转场 | 小程序无对应能力 | E1003 | 降级为无动画 |
| `@Concurrent` / worker 相关 | 小程序 worker 模型不同 | E1004 | 用小程序 worker API |
| 动态组件 `wrapBuilder` / `@LocalBuilder` 高阶用法 | 需要运行时 VDOM | E1005 | 用 `@Builder` 或独立组件 |
| 反射与动态属性访问 `this[key]`（非常量 key） | 无法静态改写为 setData | W2001 | 用显式字段名 |

## 4. 不支持/需降级的组件与能力

| ArkUI 能力 | 处理 | 说明 |
| --- | --- | --- |
| `Navigation` / `NavDestination` | 转换 | 编译为小程序路由 + 页面 |
| `Refresh` | 转换 | 页面级 → json 配置；容器级 → runtime 自绘 |
| `WaterFlow` | 降级 | 编译为双列 List 模拟，warning |
| `RelativeContainer` | error | 改用 Column/Row/Stack |
| `onBackPress` 拦截 | 降级 | 小程序无法拦截返回，warning |
| `@Provide`/`@Consume` 跨页面 | 降级 | 编译为全局 store（globalData） |
| 卡片、流转等鸿蒙系统能力 | error | 平台能力缺失 |

## 5. build() 约束

build() 是 ArkUI 的核心描述方法，ArkMP 在 ArkUI 约束基础上加强了限制（为了可静态编译）：

### 5.1 禁止副作用

build() 中**禁止**：发请求、修改状态、设置定时器。编译期检查并报错。

```ts
// ❌ 错误：build() 中有副作用
build() {
  this.fetchData();         // 编译期 error
  this.count = 1;           // 编译期 error
  Column() {
    Text('hi')
  }
}

// ✅ 正确：副作用放在生命周期或事件回调中
aboutToAppear() {
  this.fetchData();
}

build() {
  Column() {
    Text(`count: ${this.count}`)
    Button('加一').onClick(() => this.count++)
  }
}
```

### 5.2 组件声明必须静态可枚举

不支持把组件调用放进数组 `map` 后展开。请用 `ForEach`。

```ts
// ❌ 错误：动态组件展开
build() {
  Column() {
    ...this.widgets.map(w => w.render())   // 编译期 error
  }
}

// ✅ 正确：用 ForEach
build() {
  Column() {
    ForEach(this.widgets, (w: Widget) => {
      WidgetItem({ data: w })
    }, (w: Widget) => w.id)
  }
}
```

### 5.3 表达式限制

模板字符串/绑定表达式限 WXML 表达式子集。方法调用自动转为派生字段，但递归依赖或依赖方法内部状态的派生会报 error。

```ts
// ✅ 支持：三元、算术、比较、属性访问
Text(`点击次数：${this.count}`)
Text(this.isVip ? '会员' : '游客')
Text(`${this.price * this.count}`)

// ⚠️ 降级：方法调用 → 编译为派生字段（可接受但需了解开销）
Text(this.formatPrice(this.price))
// 编译器自动生成 __derived_xx 字段，每次 price 变化后重算

// ❌ 错误：递归依赖
// formatPrice 内部依赖 __derived_xx，而 __derived_xx 依赖 formatPrice → 编译期 error
```

### 5.4 单根节点

每个 build() 最多一个根节点（与 ArkUI 规则一致）。

```ts
// ✅ 正确
build() {
  Column() {
    Text('hello')
  }
}

// ❌ 错误：多个根节点
build() {
  Text('a')
  Text('b')
}
```

## 6. 状态写法约束

### 6.1 推荐写法（编译期精确改写为 setData）

```ts
// ✅ 直接赋值
this.count = 1;

// ✅ 自增/自减
this.count++;

// ✅ 复合赋值
this.count += 2;

// ✅ 展开赋值
this.list = [...this.list, item];

// ✅ 对象属性赋值
this.user.name = 'x';

// ✅ 数组索引赋值
this.list[0] = 9;
```

编译器将以上写法精确改写为 `setData` 调用：

| 源码 | 改写产物 |
| --- | --- |
| `this.count = 1` | `this.setData({ count: 1 })` |
| `this.count++` | `this.setData({ count: this.data.count + 1 })` |
| `this.count += 2` | `this.setData({ count: this.data.count + 2 })` |
| `this.list = [...this.list, 4]` | `this.setData({ list: [...this.data.list, 4] })` |
| `this.user.name = 'x'` | `this.setData({ 'user.name': 'x' })` |
| `this.list[0] = 9` | `this.setData({ 'list[0]': 9 })` |

同一函数内多处连续赋值合并为一次 `setData` 调用。

### 6.2 会落入 Proxy 兜底的写法（warning W2xxx，功能正常但有性能开销）

```ts
// ⚠️ 引用传递后修改
const ref = this.user;
ref.name = 'x';

// ⚠️ 动态键
this[dynamicKey] = 1;

// ⚠️ 状态传出后在别处修改
helper(this.list);   // helper 内部修改了 list
```

遇到 W2xxx 警告时，建议改写为推荐写法以获得更好性能。

### 6.3 硬性禁止（编译期 error）

```ts
// ❌ 不允许访问编译产物概念
this.data.xxx          // 源码里没有 data，是编译产物概念

// ❌ 源码中直接写小程序 API
setData({...})         // 报 E3xxx
```

## 7. 装饰器使用规范

### @Entry — 页面入口

```ts
@Entry({ title: '首页', pullRefresh: true })
struct Index {
  @State count: number = 0;

  build() { /* ... */ }
}
```

`@Entry` 参数映射：

| 参数 | 产物 |
| --- | --- |
| `title` | 页面 json `navigationBarTitleText` |
| `pullRefresh: true` | 页面 json `enablePullDownRefresh: true` |

### @State — 组件内部状态

```ts
@State count: number = 0;
@State list: string[] = [];
@State user: User = { name: 'test', age: 20 };
```

初始值须为编译期可序列化的字面量表达式。

### @Prop — 父→子单向传递

```ts
@Component
struct UserCard {
  @Prop name: string;
  @Prop age: number;

  build() {
    Column() {
      Text(this.name)
      Text(`${this.age}`)
    }
  }
}
```

### @Link — 父子双向同步

```ts
@Component
struct ToggleSwitch {
  @Link isOn: boolean;

  build() {
    Toggle({ type: ToggleType.Switch, isOn: this.isOn })
      .onChange((v) => this.isOn = v)   // 赋值自动回写父组件
  }
}
```

### @Watch — 状态变化监听

```ts
@State @Watch('onCountChange') count: number = 0;

onCountChange() {
  console.log(`count 变为 ${this.count}`);
}
```

### @Builder — 可复用 UI 片段

```ts
@Builder
function cardHeader(title: string) {
  Row() {
    Text(title).fontSize(16).fontWeight(FontWeight.Medium)
  }
  .width('100%')
  .padding(12)
}

// 使用
build() {
  Column() {
    cardHeader('个人信息')
    Text('内容...')
  }
}
```

### @Styles / @Extend — 样式复用

```ts
@Styles
function cardStyle() {
  .padding(12)
  .backgroundColor(Color.White)
  .borderRadius(8)
}

// 使用时内联展开
Column() {
  Text('hi')
}.cardStyle()
```

## 8. 生命周期

### 页面生命周期（@Entry）

| ArkUI 方法 | 小程序产物 | 说明 |
| --- | --- | --- |
| `aboutToAppear()` | `onLoad(options)` | 路由参数注入为 options |
| `onPageShow()` | `onShow()` | — |
| `onDidBuild()` | `onReady()` | — |
| `onPageHide()` | `onHide()` | — |
| `aboutToDisappear()` | `onUnload()` | — |

### 组件生命周期（@Component）

| ArkUI 方法 | 小程序 lifetimes |
| --- | --- |
| `aboutToAppear()` | `attached` |
| `onDidBuild()` | `ready` |
| `aboutToDisappear()` | `detached` |

## 9. 控制流写法

### if / else

```ts
// 源码
if (this.isLoading) {
  LoadingProgress()
} else {
  Text('加载完成')
}

// 产物
// <view wx:if="{{isLoading}}" class="arkmp-loading"></view>
// <text wx:else>加载完成</text>
```

### ForEach

```ts
// 源码
ForEach(this.items, (item: Item) => {
  Text(item.title)
}, (item: Item) => item.id)

// 产物
// <text wx:for="{{items}}" wx:for-item="item" wx:key="id">{{item.title}}</text>
```

键生成函数规则：
- `(item) => item.id` → `wx:key="id"`
- `(item) => item` → `wx:key="*this"`
- 缺失时 → 编译期 warning，回退 `wx:key="index"`

## 10. 平台环境限制

这些是小程序平台的固有限制，源码设计时需知晓：

| 限制 | 说明 |
| --- | --- |
| 主包 2MB / 整包 30MB | `ark-mp build` 输出体积报告，超限报 error |
| 页面栈 10 层 | `router.push` 调用过深时 runtime warning |
| 网络域名白名单 | `request` 域名需在小程序后台配置；`ark-mp check` 扫描域名生成清单 |
| setData 单包 ≤256KB | 编译器对超大初始状态 warning |

## 11. 诊断码总表

| 码段 | 级别 | 含义 |
| --- | --- | --- |
| E1xxx | error | 语法/组件不可编译 |
| W2xxx | warning | 状态写法降级（Proxy 兜底） |
| E3xxx | error | 平台能力缺失（含 wx API 直接调用） |
| W4xxx | warning | 样式降级（属性不支持，已忽略或近似） |
| E5xxx | error | 工程配置错误（路由表冲突、tabBar 不一致） |
| E7xxx | error/warning | 配置文件加载/校验问题 |
| E8xxx | error | CLI 运行时问题（文件找不到等） |

## 12. 检查清单

编写 ArkMP 源码后，确认以下事项：

- [ ] 只使用了支持的语言特性和装饰器
- [ ] build() 中无副作用（不发请求、不改状态、不定时器）
- [ ] build() 只有一个根节点
- [ ] 状态写法是推荐写法（直接赋值/自增/展开赋值），避免引用传递后修改
- [ ] 源码中没有 `this.data.xxx` 或直接调用 `setData`
- [ ] ForEach 提供了键生成函数
- [ ] 未使用 `LazyForEach`、`RelativeContainer`、`geometryTransition` 等不支持特性
- [ ] 方法调用绑定表达式可接受（编译为派生字段），但无递归依赖
- [ ] 初始状态值是编译期可序列化的字面量
