# 09. 资源与样式

## 资源引用

资源统一放在 `entry/src/main/resources/` 下，通过 `$r` / `$rawfile` 引用。

```text
resources/
├── base/
│   ├── element/      # color.json、string.json、float.json
│   ├── media/        # 图片等二进制资源
│   └── profile/      # main_pages.json、router_map.json
├── en_US/            # 英文限定资源
└── zh_CN/            # 中文限定资源
```

### 引用方式

```ts
// 颜色（在 base/element/color.json 中定义）
Text('文字').fontColor($r('app.color.primary'))

// 字符串
Text($r('app.string.app_name'))

// 图片
Image($r('app.media.icon_home'))

// 尺寸
Text('文字').fontSize($r('app.float.font_title'))

// rawfile（原始文件，如字体、html）
$rawfile('index.html')
```

资源引用的好处：多语言、深浅色（dark 目录）、多设备分辨率自动适配。

### 深浅色适配

```text
resources/
├── base/element/color.json      # 浅色
└── dark/element/color.json      # 深色同名资源
```

应用跟随系统深浅色切换时，框架自动加载对应目录资源，无需代码处理。

## @Styles：抽取通用样式

将多个组件通用的样式封装为方法，减少重复：

```ts
@Styles
function cardStyle() {
  .width('100%')
  .padding(12)
  .backgroundColor(Color.White)
  .borderRadius(8)
}

@Entry
@Component
struct Index {
  build() {
    Column({ space: 12 }) {
      Text('卡片一').cardStyle()
      Text('卡片二').cardStyle()
    }
  }
}
```

注意：

- `@Styles` 方法内只能写通用属性，不能写事件和组件特有属性。
- 不支持参数（需要参数用 `@Extend` 或 `@Builder`）。
- 可定义在组件内（不带 `function` 关键字）：`@Styles cardStyle() { ... }`。

## @Extend：针对特定组件的样式扩展

`@Extend` 装饰的方法可以访问组件特有属性和事件，且支持参数：

```ts
@Extend(Text)
function titleStyle(fontSize: number, color: ResourceColor) {
  .fontSize(fontSize)
  .fontColor(color)
  .fontWeight(FontWeight.Bold)
  .maxLines(1)
  .textOverflow({ overflow: TextOverflow.Ellipsis })
}

@Entry
@Component
struct Index {
  build() {
    Column({ space: 8 }) {
      Text('大标题').titleStyle(24, '#333333')
      Text('小标题').titleStyle(16, '#666666')
    }
  }
}
```

与 `@Styles` 的区别：

| 维度 | @Styles | @Extend |
| --- | --- | --- |
| 作用组件 | 所有组件通用属性 | 指定组件类型 |
| 参数 | 不支持 | 支持 |
| 事件绑定 | 不支持 | 支持 |

## @Builder：抽取 UI 结构

样式复用解决不了"结构复用"时，用 `@Builder`：

```ts
@Builder
function SettingItem(title: string, icon: Resource) {
  Row({ space: 12 }) {
    Image(icon).width(20).height(20)
    Text(title).fontSize(16)
    Blank()
    Image($r('app.media.arrow_right')).width(12).height(12)
  }
  .width('100%')
  .padding(12)
}

// 使用
Column() {
  SettingItem('账号安全', $r('app.media.icon_lock'))
  SettingItem('隐私设置', $r('app.media.icon_privacy'))
}
```

组件内定义的 `@Builder`（不带 `function`）可通过 `this.builder()` 引用，且能访问组件状态。

## 全局样式约定建议

- 主题色、字号阶梯统一进 `resources/base/element/`，业务代码不写死色值。
- 通用容器样式（卡片、分割线间距）用 `@Styles`；带参数的组件级样式用 `@Extend`。
- 重复的 UI 片段（列表项、设置项）用 `@Builder` 或抽成自定义组件。
