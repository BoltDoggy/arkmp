# 07. 自定义组件

自定义组件通过 `Component()` 构造器定义，是小程序代码复用的主要方式。

## 创建组件

组件由 4 个文件组成（与页面一致）：

```text
components/
└── user-card/
    ├── user-card.js
    ├── user-card.json
    ├── user-card.wxml
    └── user-card.wxss
```

```json
// user-card.json：必须声明为组件
{
  "component": true,
  "usingComponents": {}
}
```

```js
// user-card.js
Component({
  // 外部传入的属性
  properties: {
    name: {
      type: String,
      value: '默认名字'
    },
    age: {
      type: Number,
      value: 0,
      observer(newVal, oldVal) {
        // 属性变化时触发
      }
    }
  },

  // 组件内部数据
  data: {
    expanded: false
  },

  // 组件方法
  methods: {
    onToggle() {
      this.setData({ expanded: !this.data.expanded });
    },
    onTapName() {
      // 向外部派发事件
      this.triggerEvent('nametap', { name: this.properties.name });
    }
  }
});
```

```html
<!-- user-card.wxml -->
<view class="card" bindtap="onToggle">
  <text bindtap="onTapName">{{name}}（{{age}} 岁）</text>
  <view wx:if="{{expanded}}">展开的内容</view>
  <slot></slot>
</view>
```

## 使用组件

在页面 json 中注册，wxml 中以标签形式使用：

```json
{
  "usingComponents": {
    "user-card": "/components/user-card/user-card"
  }
}
```

```html
<user-card name="小明" age="{{20}}" bind:nametap="onNameTap">
  <view>这是插槽内容</view>
</user-card>
```

```js
Page({
  onNameTap(e) {
    console.log(e.detail.name);  // 接收 triggerEvent 携带的数据
  }
});
```

注意：属性传值除字符串外需用 `{{ }}` 包裹（如 `age="{{20}}"`、`disabled="{{false}}"`），否则都按字符串处理。

## 数据流向

- **父 → 子**：`properties`（单向，类似 props）。
- **子 → 父**：`this.triggerEvent('事件名', data)` + 父组件 `bind:事件名` 监听。
- **父直接调子方法**：父组件 `this.selectComponent('#id')` 获取实例后调用。

```html
<user-card id="card" name="小红" />
```

```js
const card = this.selectComponent('#card');
card.onToggle();  // 调用子组件方法
```

## 插槽 slot

默认单个匿名插槽；多插槽需在组件 js 中开启：

```js
Component({
  options: {
    multipleSlots: true
  }
});
```

```html
<!-- 组件内 -->
<slot name="header"></slot>
<slot></slot>
<slot name="footer"></slot>

<!-- 使用时 -->
<user-card>
  <view slot="header">头部</view>
  <view>默认内容</view>
  <view slot="footer">底部</view>
</user-card>
```

## 样式隔离

```js
Component({
  options: {
    styleIsolation: 'isolated'  // 默认值
  }
});
```

| 取值 | 含义 |
| --- | --- |
| `isolated` | 组件内外样式互不影响（默认） |
| `apply-shared` | 页面样式影响组件，组件不影响页面 |
| `shared` | 双向影响 |

## behaviors：组件间逻辑复用

类似 mixin，抽取多个组件共享的 data / methods / 生命周期：

```js
// behaviors/behaviors/auth.js
export default Behavior({
  data: { isLogin: false },
  methods: {
    checkLogin() {
      this.setData({ isLogin: !!wx.getStorageSync('token') });
    }
  }
});

// 组件中使用
import authBehavior from '../../behaviors/auth';

Component({
  behaviors: [authBehavior],
  attached() {
    this.checkLogin();  // 来自 behavior
  }
});
```

## 抽象节点：componentGenerics

组件可声明"抽象节点"，由使用方指定具体用什么组件填充：

```json
{
  "componentGenerics": {
    "action-button": true
  }
}
```

```html
<action-button text="{{btnText}}" />
```

```json
{
  "usingComponents": {
    "my-list": "/components/my-list/my-list"
  },
  "componentGenerics": {
    "action-button": "/components/custom-button/custom-button"
  }
}
```

适合列表项操作按钮等"结构固定、实现可变"的场景，属于进阶用法。

## 组件 vs 页面

| 维度 | Component | Page |
| --- | --- | --- |
| 构造器 | `Component()` | `Page()`（内部也是组件实现） |
| 路由 | 不可直接路由 | 可 |
| json | `"component": true` | 无 |
| 生命周期 | lifetimes / pageLifetimes | onLoad / onShow 等 |

页面也可以写成 Component 形式并在 json 中注册路由（`"component": true` 的页面），以获得 behaviors 等能力。
