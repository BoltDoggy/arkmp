# 04. 样式转换规则

本篇定义编译器如何把 ArkUI 的链式样式调用翻译为 WXSS / 内联 style。

## 总体策略

```text
.fontSize(20).fontColor('#333')      ──┐
（静态样式：编译期可求值）             ├─→ 提取为 WXSS 类（去重复用）
.width(this.boxWidth)                ──┐
（动态样式：依赖状态）                 └─→ 内联 style="{{...}}"
```

- **静态样式**：提取到页面 `.wxss`，生成语义化类名（如 `.n3` 或按组件名 `.index-title`），相同样式组合全工程去重为一个类。
- **动态样式**：留在 WXML `style="{{}}"` 属性中，绑定状态字段。

## 单位换算

编译期统一换算：`vp → rpx`，系数 ×2（750rpx 基准 ≈ 360~375vp 视宽）。

| ArkUI | WXSS | 规则 |
| --- | --- | --- |
| `.width(100)` / `.height(50)` | `width: 200rpx` | vp 数值 ×2 |
| `.fontSize(16)` | `font-size: 32rpx` | fp 按 vp 同规则换算 |
| `.width('100%')` | `width: 100%` | 百分比原样透传 |
| `.padding(12)` | `padding: 24rpx` | 对象参数 `{ top: 12, left: 16 }` 展开为四值 |
| `.border({ width: 1 })` | `border: 2rpx solid ...` | |

换算系数做成编译配置项（`unitRatio: 2`），适配特殊设计稿基准。

## 样式属性白名单映射表

| ArkUI 修饰符 | CSS | 备注 |
| --- | --- | --- |
| `.width/.height/.constraintSize` | `width/height/max-width/...` | |
| `.padding/.margin` | `padding/margin` | 支持单值/对象两种参数形式 |
| `.backgroundColor` | `background-color` | |
| `.backgroundImage` | `background-image` | $r 资源路径解析为产物 assets 路径 |
| `.borderRadius` | `border-radius` | |
| `.border` | `border` | |
| `.fontSize/.fontColor/.fontWeight/.fontStyle` | `font-size/color/font-weight/font-style` | |
| `.textAlign` | `text-align` | |
| `.maxLines + .textOverflow(Ellipsis)` | 单行：`text-overflow` 组合；多行：`-webkit-line-clamp` | 编译期按行数分流 |
| `.opacity` | `opacity` | |
| `.visibility(Hidden)` | `visibility: hidden` | `None` 则改写为条件渲染 |
| `.zIndex` | `z-index` | |
| `.position({x,y})` | `position:absolute; left/top` | Stack 子节点常用 |
| `.offset` | `transform: translate()` | |
| `.scale/.rotate` | `transform` 组合 | |
| `.shadow` | `box-shadow` | 参数近似换算 |
| `.linearGradient` | `background: linear-gradient(...)` | |
| `.aspectRatio` | `aspect-ratio`（基础库低版本降级 padding hack） | |
| `.layoutWeight(1)` | `flex: 1` | 父容器为 Row/Column 时合法，否则编译期 warning |
| `.align(Alignment.X)` | `align-self` | |

未列入白名单的修饰符：编译期 warning + 生成注释 `/* arkmp: unsupported .blur(10) */`，不阻断构建。

## 布局属性

容器参数与修饰符中的布局语义直接翻译为 flex 属性：

| ArkUI | CSS |
| --- | --- |
| `Column({ space: 12 })` | `gap: 24rpx` |
| `.justifyContent(FlexAlign.SpaceBetween)` | `justify-content: space-between` |
| `.alignItems(HorizontalAlign.Center)`（Column 内） | `align-items: center` |
| `.alignItems(VerticalAlign.Center)`（Row 内） | `align-items: center` |

编译器知道容器的轴向（Column=column / Row=row），所以 `HorizontalAlign`/`VerticalAlign` 能正确落到 `align-items` 或 `justify-content`。

## @Styles / @Extend 的处理

```ts
@Styles
function cardStyle() {
  .padding(12)
  .backgroundColor(Color.White)
  .borderRadius(8)
}
```

- `@Styles` 方法体在编译期**内联展开**到每个调用点的样式集合中，再走正常的静态提取（去重后等价于公共类）。产物中不保留 `@Styles` 概念。
- `@Extend(Text)` 带参数的样式函数：参数若为字面量，同样内联展开；参数若来自状态，降级为动态样式绑定。

## 全局样式与资源

- `app.ets` 中的全局样式约定 → `app.wxss`。
- `$r('app.color.primary')` 资源引用：编译期读取 ArkUI 工程的 `resources/base/element/color.json`，生成 WXSS 类或 CSS 变量：

```css
/* app.wxss（由资源文件生成） */
page {
  --arkmp-color-primary: #007dff;
}
```

- 深色资源 `resources/dark/` → 编译为 `@media (prefers-color-scheme: dark)` 块，并在产物 app.json 中开启 `darkmode`。

## 样式优先级与隔离

- 页面样式类按"页面名前缀"生成（`.index-xxx`），组件样式带组件名前缀，模拟作用域隔离。
- 自定义组件产物 json 中设置 `styleIsolation: 'isolated'`，与 ArkUI 组件样式天然隔离的语义对齐。
