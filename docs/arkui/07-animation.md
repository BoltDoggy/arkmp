# 07. 动画

ArkUI 动画分几类：**属性动画**（animation）、**显式动画**（animateTo）、**转场动画**（transition）、**帧动画**（keyframeAnimateTo）、**组件内转场**（如页面/共享元素）。

## 属性动画：animation

为组件的可动画属性变化添加过渡效果。当状态变化引起属性值变化时，自动按 animation 配置插值。

```ts
@State scaleValue: number = 1;

Button('缩放')
  .scale({ x: this.scaleValue, y: this.scaleValue })
  .animation({
    duration: 300,                 // 时长 ms
    curve: Curve.EaseInOut,        // 曲线
    delay: 0,
    iterations: 1,                 // -1 表示无限循环
    playMode: PlayMode.Normal
  })
  .onClick(() => {
    this.scaleValue = this.scaleValue === 1 ? 1.5 : 1;
  })
```

要点：

- `animation` 只对写在它**之前**的可动画属性生效，注意链式调用顺序。
- 常用曲线：`Linear`、`Ease`、`EaseIn`、`EaseOut`、`EaseInOut`、`FastOutSlowIn`、`Spring` 等。

## 显式动画：animateTo

用 `animateTo` 包裹状态修改，闭包内所有可动画属性按统一参数执行动画：

```ts
import { animateTo } from '@kit.ArkUI';

@State flag: boolean = false;

Column() {
  Circle()
    .width(60).height(60)
    .fill(Color.Blue)
    .position({ x: this.flag ? 200 : 0, y: this.flag ? 200 : 0 })

  Button('播放')
    .onClick(() => {
      animateTo({ duration: 500, curve: Curve.FastOutSlowIn }, () => {
        this.flag = !this.flag;   // 闭包内的状态变化都会动画化
      });
    })
}
```

`animateTo` 支持 `onFinish` 回调，适合串行动画编排。

## 转场动画：transition

组件插入/移除时（如 `if` 条件渲染、Visibility 切换）播放的进出场动画：

```ts
@State show: boolean = true;

Column() {
  if (this.show) {
    Text('我会淡入淡出并滑动')
      .transition(TransitionEffect.OPACITY
        .combine(TransitionEffect.translate({ y: 50 }))
        .animation({ duration: 300 }))
  }
  Button('切换').onClick(() => { this.show = !this.show; })
}
```

也可分别指定入场/出场：

```ts
.transition(TransitionEffect.asymmetric(
  TransitionEffect.OPACITY.combine(TransitionEffect.translate({ x: -100 })),  // 入场
  TransitionEffect.OPACITY.combine(TransitionEffect.translate({ x: 100 }))    // 出场
))
```

## 帧动画：keyframeAnimateTo

多段关键帧编排：

```ts
import { keyframeAnimateTo } from '@kit.ArkUI';

this.uiContext.keyframeAnimateTo({ iterations: 1 }, [
  {
    duration: 300,
    event: () => { this.x = 100; this.y = 0; }
  },
  {
    duration: 300,
    event: () => { this.x = 100; this.y = 100; }
  },
  {
    duration: 300,
    event: () => { this.x = 0; this.y = 0; }
  }
]);
```

## 共享元素转场：geometryTransition

两个页面/组件间元素平滑过渡（如列表图 → 详情大图）：

```ts
// 列表页
Image(url).geometryTransition('photo_' + id)

// 详情页
Image(url).geometryTransition('photo_' + id)
```

配合 Navigation 使用时设置 `.geometryTransition` 相同 id，系统会自动做共享元素动画。

## 页面/导航转场

- Router 页面：可用 `pageTransition()` 自定义页面进出场（旧方案）。
- Navigation：通过 `NavDestination` 的 `transition` 或全局 `NavPathStack` 的转场配置定制。

## 使用建议

- 简单属性过渡优先 `animation`；一次多处联动用 `animateTo`。
- 列表项删除、弹层出现等增删场景用 `transition`。
- 性能：优先动画 `scale` / `translate` / `opacity` 这类合成层属性，避免动画 `width` / `height` 触发布局重排。
