# 02. 声明式 UI 与自定义组件

## 基本结构

ArkUI 的自定义组件由装饰器和 `struct` 组成：

```ts
@Component
struct HelloComponent {
  build() {
    Text('Hello ArkUI')
  }
}
```

- `@Component`：装饰 `struct`，使其成为自定义组件。一个组件必须有且只有一个 `build()` 方法。
- `struct`：组件即结构体，实例化时无需 `new`，直接以 `HelloComponent()` 的方式使用。
- `@Entry`：页面入口组件，每个页面（路由目标）需要一个 `@Entry` 组件。

## build() 的规则

`build()` 是声明式 UI 描述区域，需遵守：

1. **允许**：组件声明、UI 描述链式调用、`if/else` 条件渲染、`ForEach` 循环渲染、`LazyForEach`、状态变量读取。
2. **不允许**：在 `build()` 中修改状态变量、发起异步请求、声明局部状态（会产生副作用或不可预期行为）。

```ts
build() {
  Column() {
    if (this.isLoading) {
      LoadingProgress()
    } else {
      Text('加载完成')
    }
  }
}
```

## 自定义组件的复用

```ts
// 定义可复用组件，成员变量可通过构造参数传入
@Component
struct UserCard {
  name: string = '默认名字';
  age: number = 18;

  build() {
    Row({ space: 8 }) {
      Text(this.name).fontSize(16)
      Text(`${this.age} 岁`).fontSize(14).fontColor(Color.Gray)
    }
    .padding(12)
  }
}

// 使用
@Entry
@Component
struct Index {
  build() {
    Column({ space: 10 }) {
      UserCard({ name: '小明', age: 20 })
      UserCard({ name: '小红' })  // age 使用默认值
    }
  }
}
```

> 注意：普通成员变量（如 `name`、`age`）传参后不会形成双向绑定，详见 [03-状态管理](03-state-management.md)。

## 组件生命周期

自定义组件拥有以下生命周期回调：

| 回调 | 触发时机 |
| --- | --- |
| `aboutToAppear()` | 组件即将出现时（build 之前），适合做初始化 |
| `onDidBuild()` | build 完成之后，不适合做状态修改 |
| `aboutToDisappear()` | 组件即将销毁，适合释放资源、取消订阅 |

页面级组件（`@Entry`）额外拥有：

| 回调 | 触发时机 |
| --- | --- |
| `onPageShow()` | 页面每次显示时 |
| `onPageHide()` | 页面每次隐藏时 |
| `onBackPress()` | 用户点击返回键，返回 `true` 表示拦截返回 |

```ts
@Entry
@Component
struct Index {
  aboutToAppear(): void {
    console.info('组件即将出现');
  }

  onPageShow(): void {
    console.info('页面显示');
  }

  onBackPress(): boolean {
    // 返回 true 则阻止系统默认返回行为
    return false;
  }

  aboutToDisappear(): void {
    console.info('组件即将销毁');
  }

  build() {
    Text('生命周期示例')
  }
}
```

## 条件渲染与循环渲染

### if / else

```ts
if (this.hasLogin) {
  Text('欢迎回来')
} else {
  Button('去登录').onClick(() => { this.hasLogin = true; })
}
```

`if/else` 分支切换会销毁并重建分支内组件，组件内的 `@State` 会丢失；如需保留状态可调整状态位置或使用 `visibility` 控制显隐。

### ForEach

```ts
ForEach(
  this.items,                      // 数据源数组
  (item: string) => {              // 单个条目 UI 生成
    Text(item)
  },
  (item: string) => item           // 键生成函数，需保证唯一稳定
)
```

- 键生成函数用于 diff，键不稳定会导致多余的重建与状态错乱。
- 数据量大且需要懒加载时使用 `LazyForEach`（需实现 `IDataSource` 接口）。
