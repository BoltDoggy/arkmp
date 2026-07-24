# @arkmp/runtime

ArkMP 产物侧运行时：在编译产物小程序工程中提供 state → data 桥接、生命周期分发、事件参数规范化与内置基础样式（对应设计文档 05/06 篇）。

## 所属层

L5 runtime（独立子树，不进入编译器依赖链）。

## 依赖

无外部依赖（`package.json` 仅含构建/测试用 devDependencies）。运行时无运行期第三方依赖，构建为单文件产物，直接拷贝进小程序工程。

## 导出 API

### `createPage(options: PageOptions): void`

页面构造器封装。将 ArkUI 页面（`@Entry` + `@Component`）的状态、派生字段、`@Watch`、方法映射为原生 `Page(config)`：`state` 桥接为 `data` + 批量 `setData`，`aboutToAppear`/`onPageShow`/`onDidBuild`/`onPageHide`/`aboutToDisappear`/`onPullRefresh` 映射为对应 Page 生命周期钩子（`onLoad` 中安装状态桥接）。返回 `void`。

### `createComponent(options: ComponentOptions): void`

组件构造器封装。将 ArkUI 自定义组件（`@Component`）的 `properties`、`state`、`derived`、`watch`、`methods` 映射为原生 `Component(config)`：生命周期方法映射为 `lifetimes.attached/ready/detached`，`@Watch` 桥接为 `observers`，保留用户自定义 `observers`/`lifetimes`。返回 `void`。

### `normalizeEvent(e: Record<string, any>): NormalizedEvent`

事件参数规范化。抹平 `tap`/`touch`/表单事件的结构差异，统一返回 `NormalizedEvent`（`type`、`detail`、`id`、`dataset`、`x`、`y`、`timeStamp`）。

### `BASE_WXSS: string`

编译器写入产物 wxss 的内置基础类定义（`.arkmp-page`/`.arkmp-col`/`.arkmp-row`/`.arkmp-text`/`.arkmp-btn`），字符串常量。

### 类型

- `PageOptions`：`createPage` 入参，含 `state?`、`derived?`、`watch?`、`methods?` 及其余原生 Page 配置透传。
- `ComponentOptions`：`createComponent` 入参，含 `state?`、`properties?`、`derived?`、`watch?`、`methods?` 及其余原生 Component 配置透传。
- `StateDef`：`Record<string, unknown>`，状态字段定义。
- `WatchHandler`：`string | Fn`，`@Watch` 回调（方法名字符串或函数，签名 `(value, key)`）。
- `WatchDef`：`Record<string, WatchHandler>`。
- `DerivedFn`：`(this, data) => unknown`，派生字段计算函数。
- `DerivedSpec`：`[...依赖字段, 计算函数]`。
- `DerivedDef`：`Record<string, DerivedSpec>`。
- `NormalizedEvent`：`normalizeEvent` 返回值结构。

## 用法示例

```ts
import { createPage, BASE_WXSS } from '@arkmp/runtime';

createPage({
  state: { count: 0, items: [] as number[] },
  derived: {
    double: ['count', (data) => data.count * 2],
  },
  watch: { count: 'onCountChange' },
  methods: {
    aboutToAppear() {
      // → onLoad
    },
    onCountChange(value: number) {
      // @Watch 回调
    },
    onTap() {
      this.count++; // 自动桥接为批量 setData
    },
  },
});
```

组件示例：

```ts
import { createComponent } from '@arkmp/runtime';

createComponent({
  properties: { label: String },
  state: { open: false },
  watch: { label: 'onLabelChange' },
  methods: {
    aboutToAppear() {
      // → lifetimes.attached
    },
    toggle() {
      this.open = !this.open;
    },
  },
});
```

## 测试

```bash
pnpm --filter @arkmp/runtime test
```
