# 08. 语法子集与限制

ArkMP 的输入是 ArkTS/ArkUI 的**可编译子集**：比完整 ArkTS 窄（去掉无法映射到小程序的能力），但保证是合法 ArkUI——同一份源码可以被 DevEco Studio 正常检查（便于未来真的双端复用）。越界写法一律编译期诊断，不做"猜着转"。

## 支持的语言特性

| 类别 | 支持 | 说明 |
| --- | --- | --- |
| 类型系统 | 接口、类型别名、枚举、泛型函数 | 编译产物为 JS，类型擦除 |
| 装饰器 | @Entry / @Component / @State / @Prop / @Link / @Provide / @Consume / @Observed / @ObjectLink / @Watch / @Builder / @Styles / @Extend / @StorageLink | 转换规则见 05 篇 |
| 控制流 | if/else、ForEach（含嵌套）、三元表达式 | 见 03 篇 |
| 异步 | async/await、Promise | 产物基础库 2.10+ 均支持 |
| 模块化 | import/export | 编译为 CommonJS（小程序模块规范） |

## 不支持的语言特性（编译期 error）

| 特性 | 原因 | 错误码 |
| --- | --- | --- |
| `LazyForEach` + IDataSource | 小程序无等价懒加载协议，降级语义差异大 | E1001 |
| 组件内 `animateTo` 闭包外的动画编排、`keyframeAnimateTo` 复杂编排 | WXML 无法精确表达 | E1002 |
| `geometryTransition` 共享元素转场 | 小程序无对应能力 | E1003 |
| `@Concurrent` / worker 相关 | 小程序 worker 模型不同 | E1004 |
| 动态组件 `wrapBuilder` / `@LocalBuilder` 高阶用法 | 需要运行时 VDOM，违背编译期直出原则 | E1005 |
| 反射与动态属性访问 `this[key]`（非常量 key） | 无法静态改写为 setData | W2001（降级 Proxy） |

## 不支持/需降级的组件与能力

| ArkUI 能力 | 处理 | 说明 |
| --- | --- | --- |
| `Navigation` / `NavDestination` | 转换 | 编译为小程序路由 + 页面（见 06 篇） |
| `Refresh` | 转换 | 页面级 → json 配置；容器级 → runtime 自绘 |
| `WaterFlow` | 降级 | 编译为双列 List 模拟，warning 提示 |
| `RelativeContainer` | error | 建议改用 Column/Row/Stack；规则复杂且可读性差 |
| `onBackPress` 拦截 | 降级 | 小程序无法拦截返回，warning 提示改交互设计 |
| `@Provide`/`@Consume` 跨页面 | 降级 | 跨页面共享编译为全局 store（globalData） |
| 卡片、流转等鸿蒙系统能力 | error | 见 06 篇"平台能力缺失" |

## build() 约束

继承 ArkUI 对 build() 的约束并加强（为了可静态编译）：

1. build() 中禁止副作用：发请求、改状态、定时器——编译期检查并报错。
2. 组件声明必须是**静态可枚举**的调用结构；不支持把组件调用放进数组 map 后再展开（请用 ForEach）。
3. 模板字符串/绑定表达式限 WXML 表达式子集；方法调用自动转派生字段（05 篇），但递归依赖或依赖方法内部状态的派生报 error。
4. 每个 build() 最多一个根节点（ArkUI 同规）。

## 状态写法约束（为编译期改写服务）

推荐写法（可被编译期精确改写为 setData）：

```ts
this.count = 1;
this.count++;
this.user.name = 'x';
this.list = [...this.list, item];
```

会落入 Proxy 兜底（warning）的写法：

```ts
const ref = this.user;   // 引用传递后修改
ref.name = 'x';

this[dynamicKey] = 1;    // 动态键

helper(this.list);       // 状态传出后在别处修改
```

硬性禁止（error）：

```ts
this.data.xxx            // 不允许访问编译产物概念，源码里没有 data
setData({...})           // 源码中直接写小程序 API 报 E3xxx
```

## 产物环境限制（微信侧固有）

这些是小程序平台本身的天花板，ArkMP 无法突破，源码设计时需知晓：

- 包体积：主包 2MB / 整包 30MB（编译器 build 时输出体积报告与超限 error）。
- 页面栈 10 层：`router.push` 调用链过深时 runtime 会 warning。
- 网络域名白名单：request 域名需在 mp 后台配置（`ark-mp check` 会扫描源码中的域名并生成待配置清单）。
- setData 单包建议 ≤256KB：编译器对超大初始状态（如内嵌大 JSON）warning。

## 诊断码总表（节选）

| 码 | 级别 | 含义 |
| --- | --- | --- |
| E1xxx | error | 语法/组件不可编译 |
| W2xxx | warning | 状态写法降级（走 Proxy 兜底，性能提示） |
| E3xxx | error | 平台能力缺失（含 wx API 直接调用） |
| W4xxx | warning | 样式降级（属性不支持，已忽略或近似） |
| E5xxx | error | 工程配置错误（路由表冲突、tabBar 不一致等） |

完整诊断码列表随编译器仓库维护：`packages/compiler/src/diagnostics/`。
