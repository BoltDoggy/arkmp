# 01. ArkUI 概述

## 什么是 ArkUI

ArkUI 是 HarmonyOS 的原生 UI 开发框架，提供：

- **声明式 UI 范式**：通过描述"界面长什么样"而非"如何一步步绘制"来构建 UI，状态变化时框架自动刷新界面。
- **ArkTS 语言**：基于 TypeScript 扩展而来，强制静态类型检查，并内置装饰器（如 `@Entry`、`@Component`、`@State`）支撑声明式开发。
- **跨设备能力**：一套代码可运行在手机、平板、折叠屏、智慧屏等多种设备上，支持自适应布局与响应式布局。

## 整体架构

```text
┌─────────────────────────────────────────┐
│  应用层：ArkTS 页面与自定义组件            │
├─────────────────────────────────────────┤
│  声明式 UI 前端（ArkUI 框架层）            │
│  · 组件树管理 · 状态管理 · 布局引擎        │
├─────────────────────────────────────────┤
│  渲染引擎（渲染管线 / 图形）               │
├─────────────────────────────────────────┤
│  平台适配层（HarmonyOS 系统能力）          │
└─────────────────────────────────────────┘
```

## 声明式 vs 命令式

命令式 UI（以传统 Android View 为例）需要手动获取控件、设置属性：

```java
TextView tv = findViewById(R.id.title);
tv.setText("你好");
```

声明式 UI 直接描述界面与状态的绑定关系：

```ts
@State message: string = '你好';

build() {
  Text(this.message)  // message 变化时，Text 自动刷新
}
```

当 `message` 被 `@State` 装饰并发生变化时，ArkUI 只重新执行受影响的 `build()` 区域，而不是重建整棵树。

## 最小可运行示例

一个 HarmonyOS 页面的最小结构：

```ts
// entry/src/main/ets/pages/Index.ets
@Entry
@Component
struct Index {
  @State count: number = 0;

  build() {
    Column({ space: 12 }) {
      Text(`点击次数：${this.count}`)
        .fontSize(24)
      Button('点我 +1')
        .onClick(() => {
          this.count++;
        })
    }
    .width('100%')
    .height('100%')
    .justifyContent(FlexAlign.Center)
  }
}
```

要点：

- `@Entry`：标记该组件为页面入口组件。
- `@Component`：标记 `struct Index` 为一个自定义组件。
- `@State`：组件内部状态，变化驱动 UI 刷新。
- `build()`：声明 UI 结构，只能进行声明式描述，不能有副作用逻辑（如网络请求）。

## 工程目录约定

```text
entry/
└── src/main/
    ├── ets/
    │   ├── entryability/      # UIAbility（应用入口）
    │   └── pages/             # 页面（@Entry 组件）
    └── resources/             # 资源（颜色、字符串、媒体等）
```

> 说明：从 API 12 起，推荐使用 Navigation 作为页面导航方案，配合 `@Entry` 的页面写法仍然兼容。
