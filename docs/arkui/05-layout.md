# 05. 布局

## 布局容器总览

| 容器 | 特点 | 典型场景 |
| --- | --- | --- |
| `Row` | 水平线性排布 | 一行内的图文、按钮组 |
| `Column` | 垂直线性排布 | 页面主体结构、表单 |
| `Stack` | 层叠（后声明的在上层） | 角标、悬浮按钮、遮罩 |
| `Flex` | 弹性布局（可换行） | 自适应一行放不下时换行 |
| `Grid` / `GridItem` | 网格 | 相册、应用列表 |
| `RelativeContainer` | 相对定位 | 复杂对齐关系 |
| `List` / `WaterFlow` | 滚动列表 / 瀑布流 | 信息流 |

## 尺寸单位

- `vp`：虚拟像素，默认单位，随屏幕密度缩放，数字直接写如 `.width(100)`。
- `fp`：字体像素，跟随系统字体大小设置（`.fontSize(16)` 默认即 fp）。
- `lpx`：逻辑像素，以设计稿宽度为基准换算，需在资源中配置 designWidth。
- 百分比：`.width('50%')`、`.height('100%')`。

## Row 与 Column

### 主轴与交叉轴

- `Row`：主轴水平，交叉轴垂直。
- `Column`：主轴垂直，交叉轴水平。

```ts
Row({ space: 10 }) {  // space：子组件间距
  Text('A')
  Text('B')
}
.justifyContent(FlexAlign.SpaceBetween)  // 主轴对齐
.alignItems(VerticalAlign.Center)        // 交叉轴对齐
```

`justifyContent` 常用值：`Start` / `Center` / `End` / `SpaceBetween` / `SpaceAround` / `SpaceEvenly`。

### 两端对齐常见写法

```ts
Row() {
  Text('标题')
  Blank()                       // 吃掉中间剩余空间
  Text('更多 >')
}
.width('100%')
.padding(12)
```

### 子组件拉伸与占比

```ts
Row() {
  Text('左').width(80)
  Text('中').layoutWeight(1)   // 占满剩余空间
  Text('右').width(80)
}
```

`layoutWeight` 类似 CSS 的 `flex-grow`，只在 Row / Column / Flex 容器中生效。

## Stack：层叠布局

```ts
Stack({ alignContent: Alignment.BottomEnd }) {
  Image($r('app.media.cover'))
    .width('100%').height(200)
  Badge({ count: 3, style: BadgeStyle.DEFAULT })
    .position({ x: '90%', y: 10 })   // 也可绝对定位
}
.width('100%')
```

子组件默认堆叠在左上角，`alignContent` 控制整体对齐，`align` 或 `position` / `offset` 可精细控制单个子组件。

## Flex：可换行的弹性布局

```ts
Flex({ wrap: FlexWrap.Wrap, justifyContent: FlexAlign.Start }) {
  ForEach(this.tags, (tag: string) => {
    Text(tag)
      .padding({ left: 10, right: 10, top: 4, bottom: 4 })
      .backgroundColor('#F0F0F0')
      .borderRadius(4)
      .margin(4)
  }, (tag: string) => tag)
}
```

标签流、筛选条件等"一行放不下就换行"的场景用 Flex 比 Row 更合适。

## Grid：网格

```ts
Grid() {
  ForEach(this.photos, (url: string) => {
    GridItem() {
      Image(url).aspectRatio(1).objectFit(ImageFit.Cover)
    }
  }, (url: string) => url)
}
.columnsTemplate('1fr 1fr 1fr')   // 3 等分列
.columnsGap(4).rowsGap(4)
```

- `columnsTemplate('1fr 2fr 1fr')` 可定义不等宽列。
- 行数由数据量自动推算；横向滚动网格用 `rowsTemplate`。

## RelativeContainer：相对布局

```ts
RelativeContainer() {
  Text('标题')
    .id('title')
    .alignRules({
      top: { anchor: '__container__', align: VerticalAlign.Top },
      left: { anchor: '__container__', align: HorizontalAlign.Start }
    })
  Text('副标题')
    .alignRules({
      top: { anchor: 'title', align: VerticalAlign.Bottom },
      left: { anchor: 'title', align: HorizontalAlign.Start }
    })
}
```

适合存在复杂相互对齐关系的场景；简单线性排列优先用 Row/Column，更易读。

## 通用布局属性

```ts
Column() {
  // ...
}
.width('100%')                 // 宽高
.height(200)
.padding({ top: 12, bottom: 12, left: 16, right: 16 })  // 内边距
.margin({ bottom: 8 })         // 外边距
.backgroundColor('#FFFFFF')
.border({ width: 1, color: '#EEEEEE', radius: 8 })
```

- `padding` 与 `margin` 支持单值、四值对象或方向对象三种写法。
- 约束：先设置的宽高可能被后续 `constraintSize` 覆盖，注意调用顺序。

## 自适应与响应式建议

- 优先使用 `layoutWeight`、`'100%'`、`Flex`、`Grid` 的 `fr` 单位，避免写死具体像素宽度。
- 折叠屏 / 平板适配可使用断点系统（`@ohos.mediaquery`）或栅格布局组件 `GridRow` / `GridCol`。
