# 04. WXSS 与样式

WXSS 基本兼容 CSS，并扩展了尺寸单位 `rpx` 和样式导入。

## rpx：响应式像素

- 规定屏幕宽为 750rpx，即 `1rpx = 屏幕宽度 / 750`。
- 在 iPhone 6（375pt 宽）上，1rpx ≈ 0.5px，设计稿按 750px 宽出图即可 1:1 换算。

```css
.card {
  width: 702rpx;        /* 750 - 24*2 边距 */
  margin: 0 24rpx;
  font-size: 28rpx;
  border-radius: 16rpx;
}
```

建议：布局尺寸统一用 rpx；字体也可使用 rpx 保证等比缩放，或按需求用 px 固定。

## 样式导入

```css
/* app.wxss */
@import "styles/common.wxss";
```

`@import` 支持相对路径和绝对路径（`/styles/common.wxss`）。

## 样式作用域

- `app.wxss`：全局样式，作用于所有页面。
- 页面 `.wxss`：仅作用于当前页面，且优先级高于全局同名规则。
- 组件 `.wxss`：默认样式隔离（详见自定义组件的 `styleIsolation`）。

## 选择器支持

支持大部分常用选择器：`.class`、`#id`、`element`、`.a .b` 后代、`::before` / `::after` 伪类。`page` 选择器代表页面根节点，可设置页面背景：

```css
page {
  background-color: #f5f5f5;
  height: 100%;
}
```

## 常用布局写法

### Flex 布局（小程序布局的主力）

```css
.row {
  display: flex;
  align-items: center;           /* 交叉轴居中 */
  justify-content: space-between; /* 主轴两端对齐 */
}

.grow {
  flex: 1;                       /* 占满剩余空间 */
  min-width: 0;                  /* 配合文本省略避免被撑开 */
}
```

### 单行/多行文本省略

```css
.ellipsis {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.ellipsis-2 {
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
```

### 安全区适配（刘海屏底部）

```css
.footer {
  padding-bottom: constant(safe-area-inset-bottom);
  padding-bottom: env(safe-area-inset-bottom);
}
```

也可通过 `wx.getWindowInfo().safeArea` 在 JS 中获取安全区尺寸。

## 深色模式

在 `app.json` 中开启：

```json
{
  "darkmode": true
}
```

然后在 `app.wxss` 中使用媒体查询：

```css
@media (prefers-color-scheme: dark) {
  page {
    background-color: #1a1a1a;
    color: #e5e5e5;
  }
}
```

## 样式建议

- 统一设计稿基准 750 宽，全部用 rpx，避免 px/rpx 混用。
- 公共色值、字号、间距抽到 `styles/variables.wxss`（用 class 或 CSS 变量统一管理）。
- 避免过深选择器嵌套，组件内依赖样式隔离减少互相污染。
