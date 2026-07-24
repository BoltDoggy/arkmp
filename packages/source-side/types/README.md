# @arkmp/types

> 对外发布包

ArkMP 源码侧（`.ets`）全局类型声明：以 ambient `.d.ts` 模拟 ArkUI 全局 DSL 命名空间，为源码提供类型提示，无运行时产物。

## 所属层

L6 source-side（独立子树）。

## 依赖

无外部依赖（`package.json` 仅含构建/测试用 devDependencies：`tsd`、`typescript`）。本包仅发布单个 `index.d.ts`，不含任何可执行代码，无构建步骤。

## 导出 API

本包不含 `import/export`，全部为全局 ambient 声明，覆盖以下几类：

### 装饰器（08 篇装饰器白名单，共 14 个）

`@Entry`（支持 `{ routeName? }` 参数）、`@Component`、`@Observed`、`@State`、`@Prop`、`@Link`、`@Provide`、`@Consume`、`@ObjectLink`、`@Builder`、`@Styles`、`@Extend(component)`、`@Watch(propName)`、`@StorageLink(key)`。

### 枚举

对齐与取值类枚举：`FlexAlign`、`HorizontalAlign`、`VerticalAlign`、`Alignment`、`Visibility`、`ImageFit`、`ToggleType`、`FontWeight`、`FontStyle`、`TextAlign`、`TextOverflow`、`Color`（常用颜色常量，值为 CSS 颜色字符串）。

### 资源与基础值类型

- `$r(value): ArkResource`、`$rawfile(value): ArkResource`：引用应用资源（`media`/`color`/`string`/`rawfile`）。
- `ArkLength`（`number | string`，number 按 vp 处理）、`ArkColor`、`ArkEdgeInsets`、`ArkPosition`、`ArkOffset`、`ArkConstraintSize`、`ArkBorderOptions`、`ArkShadowOptions`、`ArkLinearGradientOptions`、`ArkScaleOptions`、`ArkRotateOptions`。

### 事件类型

`ArkClickEvent`、`ArkTouchEvent`（用于 `onClick`/`onTouch` 回调签名）。

### 链式修饰符与组件

- `ArkCommonAttribute<Self>`：公共流式修饰符（尺寸/间距/背景边框/文本/渲染/定位变换/布局/事件），链式调用保持具体类型。
- 布局容器：`Column`、`Row`、`Stack`、`Flex`、`Scroll`、`List`/`ListItem`、`Grid`/`GridItem`、`Swiper`、`Tabs`/`TabContent`，各自有 `*Attribute` 与 `*Options`。
- 基础组件：`Text`、`Image`、`Button`、`TextInput`、`TextArea`、`Toggle`、`Checkbox`、`Radio`、`Slider`、`Progress`、`LoadingProgress`、`Divider`、`Blank`、`Badge`、`Web`、`Video`、`Canvas`。

### 控制流

`ForEach<T>(items, itemGenerator, keyGenerator?)`：数组渲染（编译为 `wx:for`）。

### 路由 API

`router` 命名空间：`push`/`replace`/`back`/`pop(result?)`/`switchTab`/`relaunch`（编译为 `wx.navigateTo`/`wx.redirectTo`/`wx.navigateBack`/`eventChannel.emit`/`wx.switchTab`/`wx.reLaunch`）。

## 用法示例

```ts
// 本包为 ambient 声明，引入方式见 @arkmp/api；此处展示被声明的数据结构形态。
// ArkLength：number 按 vp，字符串透传
const w: ArkLength = 100;          // → 100vp → 编译期 ×2 换算为 200rpx
const full: ArkLength = '100%';    // 字符串透传

// 颜色：Color 枚举或 CSS 颜色字符串
const c: ArkColor = Color.Red;     // '#ff0000'
const custom: ArkColor = '#112233';

// 边距：单值或四方向对象
const m1 = 8;                       // number 单值
const m2: ArkEdgeInsets = { top: 4, left: 8 };

// 资源引用
const logo: ArkResource = $r('app.media.logo');
```

## 测试

```bash
pnpm --filter @arkmp/types test
```
