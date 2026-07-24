# ArkMP：用 ArkUI 语法开发微信小程序

本目录是 **ArkMP 编译工具**的设计文档。ArkMP 是一个类似 Taro 的构建工具：开发者用 ArkUI / ArkTS 的声明式语法（`@Entry`、`@Component`、`@State`、`build()` 链式 UI 描述）编写代码，ArkMP 将其编译为标准微信小程序工程（WXML / WXSS / JS / JSON），产出可在微信开发者工具中直接预览、上传的产物。

> 注意：ArkMP 的目标**不是跨端**——输出端只有微信小程序一个。它解决的是"让熟悉 ArkUI 的开发者（或已有 ArkUI 代码资产）用同一套语法开发小程序"。

## 设计目标

- **语法保真**：源码就是合法的 ArkUI 子集，可被 DevEco Studio 正常高亮与类型检查。
- **产物可读**：编译产物是结构清晰的标准小程序代码，可脱离 ArkMP 继续维护（eject 友好）。
- **运行时轻量**：运行时桥接层（runtime）体积控制在 10KB 以内，只做状态桥接与事件规范化。
- **编译期优先**：能在编译期做的转换（组件映射、样式提取、静态赋值改写）不放运行时。

## 文档索引

| 文档 | 内容 |
| --- | --- |
| [01-总体设计](01-overview.md) | 架构总览、编译管线、目录与产物结构 |
| [02-编译流程](02-pipeline.md) | 解析、IR、各转换阶段、代码生成的详细设计 |
| [03-组件转换规则](03-component-mapping.md) | ArkUI 组件 → WXML 映射表与 build() 转换规则 |
| [04-样式转换规则](04-style-mapping.md) | 链式样式 → WXSS、单位换算、@Styles/@Extend 处理 |
| [05-状态与生命周期转换](05-state-lifecycle-mapping.md) | 装饰器 → data/setData 桥接、生命周期映射、运行时方案 |
| [06-运行时与 API 适配层](06-api-mapping.md) | runtime 库设计、路由抽象、wx.* API 映射 |
| [07-工程与 CLI 设计](07-cli.md) | 项目结构、配置文件、dev/build 命令、调试链路 |
| [08-语法子集与限制](08-limitations.md) | 支持的 ArkTS 子集、不支持特性与诊断策略 |
| [09-monorepo 工程分层](09-monorepo.md) | pnpm monorepo 结构、package 原子化划分、依赖规则与测试策略 |

## 一个编译示例（先看效果）

输入（ArkUI 源码 `pages/Index.ets`）：

```ts
@Entry
@Component
struct Index {
  @State count: number = 0;

  build() {
    Column({ space: 12 }) {
      Text(`点击次数：${this.count}`).fontSize(20)
      Button('点我 +1').onClick(() => { this.count++; })
    }
    .width('100%')
    .justifyContent(FlexAlign.Center)
  }
}
```

输出（微信小程序产物）：

```html
<!-- pages/index/index.wxml -->
<view class="arkmp-col arkmp-page">
  <text class="arkmp-text" style="font-size:20rpx">点击次数：{{count}}</text>
  <view class="arkmp-btn" bindtap="__e0">点我 +1</view>
</view>
```

```js
// pages/index/index.js
const { createPage } = require('@arkmp/runtime');

createPage({
  state: { count: 0 },
  methods: {
    __e0() { this.count++; }   // 由运行时桥接为 setData
  }
});
```

转换细节见后续各篇。
