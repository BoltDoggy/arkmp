# 08. 手势处理

ArkUI 通过 `gesture` 修饰符为组件绑定手势，也提供更高层的事件回调（`onClick`、`onTouch`）。

## 点击与触摸

```ts
Text('点我')
  .onClick(() => { /* 点击 */ })

// 更底层的触摸事件
Text('触摸')
  .onTouch((event: TouchEvent) => {
    if (event.type === TouchType.Down) {
      console.info('按下');
    }
  })
```

## 手势类型

通过 `.gesture(GestureType)` 绑定：

```ts
Text('手势目标')
  .gesture(
    TapGesture({ count: 2 })          // 双击
      .onAction(() => {
        console.info('双击');
      })
  )
```

### 常用手势

| 手势 | 说明 | 关键参数/回调 |
| --- | --- | --- |
| `TapGesture` | 点击 | `count`（连击次数）、`onAction` |
| `LongPressGesture` | 长按 | `duration`（触发时长）、`onAction` / `onActionEnd` |
| `PanGesture` | 拖动 | `onActionStart` / `onActionUpdate` / `onActionEnd`，事件含偏移量 |
| `SwipeGesture` | 滑动 | `direction`、`onAction` |
| `PinchGesture` | 捏合缩放 | `onActionUpdate` 中取 `event.scale` |
| `RotationGesture` | 旋转 | `onActionUpdate` 中取 `event.angle` |
| `LongPressGesture` + `PanGesture` | 长按拖拽 | 用 `GestureGroup` 组合 |

### 拖动示例

```ts
@State offsetX: number = 0;
@State offsetY: number = 0;

Circle()
  .width(60).height(60).fill(Color.Orange)
  .translate({ x: this.offsetX, y: this.offsetY })
  .gesture(
    PanGesture()
      .onActionUpdate((event: GestureEvent) => {
        this.offsetX = event.offsetX;
        this.offsetY = event.offsetY;
      })
      .onActionEnd(() => {
        // 松手回弹
        animateTo({ duration: 200 }, () => {
          this.offsetX = 0;
          this.offsetY = 0;
        });
      })
  )
```

### 捏合缩放示例

```ts
@State scaleValue: number = 1;

Image($r('app.media.photo'))
  .scale({ x: this.scaleValue, y: this.scaleValue })
  .gesture(
    PinchGesture()
      .onActionUpdate((event: GestureEvent) => {
        this.scaleValue = event.scale;
      })
  )
```

## 手势组合：GestureGroup

当需要多种手势共存时，用 `GestureGroup` 指定竞争关系：

```ts
.gesture(
  GestureGroup(
    GestureMode.Exclusive,   // 互斥：先识别成功的生效
    TapGesture({ count: 1 }).onAction(() => { console.info('单击'); }),
    TapGesture({ count: 2 }).onAction(() => { console.info('双击'); })
  )
)
```

- `Exclusive`：互斥，常用于单击/双击区分。
- `Parallel`：并行，多个手势同时识别（如缩放 + 旋转）。
- `Sequence`：顺序，前一个手势成功后才识别下一个。

## 手势与滚动容器的冲突

在 `Scroll` / `List` 内部绑 `PanGesture` 容易和容器滚动竞争：

- 使用 `.gesture(gesture, GestureMask.IgnoreInternal)` 等方式调整优先级。
- 或使用 `parallelGesture` 让自定义手势与内置手势并行响应。

```ts
Scroll() {
  // ...
}
.parallelGesture(
  PanGesture().onActionUpdate((event) => { /* 与滚动并行 */ })
)
```

## 事件冒泡与拦截

- 子组件命中后会向上冒泡，父组件同样绑定的事件会被触发。
- 子组件可用 `.onClick(() => {}).stopPropagation` 相关能力或通过手势优先级控制，避免重复触发（具体以当前 API 版本行为为准）。
