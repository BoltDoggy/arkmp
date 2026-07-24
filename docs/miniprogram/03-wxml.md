# 03. WXML 与数据绑定

## 数据绑定

WXML 中使用 `{{ }}` 插值表达式绑定 `data` 中的数据：

```html
<view>{{message}}</view>
<view>{{user.name}}，{{user.age}} 岁</view>
<view>{{count + 1}}</view>
<view>{{isVip ? '会员' : '普通用户'}}</view>
```

绑定也可用在属性中：

```html
<image src="{{avatarUrl}}" mode="aspectFill" />
<view class="{{active ? 'item item-active' : 'item'}}"></view>
<view hidden="{{!visible}}">条件隐藏</view>
```

数据更新必须通过 `setData`：

```js
Page({
  data: {
    message: '初始文本',
    list: [1, 2, 3]
  },

  onLoad() {
    // ✅ 正确：触发视图更新
    this.setData({ message: '更新后的文本' });

    // ❌ 错误：直接赋值不触发视图更新
    // this.data.message = '更新后的文本';

    // 支持路径写法与计算 key
    this.setData({
      'list[0]': 100,
      ['user.name']: '小明'
    });
  }
});
```

注意：

- `setData` 是异步的，第二个参数可传回调在视图更新后执行。
- 单次 setData 数据量建议不超过 256KB；高频场景（如滚动跟随）考虑节流。

## 条件渲染

### wx:if / wx:elif / wx:else

```html
<view wx:if="{{status === 'loading'}}">加载中...</view>
<view wx:elif="{{status === 'empty'}}">暂无数据</view>
<view wx:else>数据内容</view>
```

`wx:if` 切换时组件会被销毁/重建，内部状态丢失。

### hidden

```html
<view hidden="{{!showPanel}}">只是切换显示，不销毁</view>
```

`hidden` 通过样式控制显隐，组件实例保留。频繁切换用 `hidden`，切换少且初始不必渲染用 `wx:if`。

## 列表渲染：wx:for

```html
<view wx:for="{{items}}" wx:key="id" wx:for-item="item" wx:for-index="index">
  {{index}} - {{item.name}}
</view>
```

- `wx:key`：提升 diff 效率，值为字符串时表示 item 的该字段（如 `"id"`），或 `*this` 表示 item 本身（适用于字符串/数字数组）。务必提供稳定唯一 key。
- 默认循环变量名为 `item`、下标为 `index`，可用 `wx:for-item` / `wx:for-index` 改名（嵌套循环时必须改名）。
- `block` 标签可包裹多个节点而不产生额外节点：

```html
<block wx:for="{{items}}" wx:key="id">
  <text>{{item.name}}</text>
  <text>{{item.price}}</text>
</block>
```

## 事件绑定

```html
<button bindtap="onTap">冒泡绑定</button>
<button catchtap="onTap">阻止冒泡</button>
<view bind:touchstart="onTouchStart">等价写法</view>
```

- `bindxxx`：冒泡事件，会向上层传播；`catchxxx`：阻止冒泡。
- 常用事件：`tap`、`longpress`、`touchstart` / `touchmove` / `touchend`、`input`、`change`、`submit`、`scrolltolower`。

事件处理函数与传参：

```html
<button data-id="{{item.id}}" data-type="book" bindtap="onItemTap">查看</button>
```

```js
Page({
  onItemTap(e) {
    // e.currentTarget.dataset 获取 data-* 参数（推荐）
    const { id, type } = e.currentTarget.dataset;

    // e.detail 承载组件特有数据（如 input 的 value）
  },

  onInput(e) {
    this.setData({ keyword: e.detail.value });
  }
});
```

`e.currentTarget` 是事件绑定的节点，`e.target` 是实际触发节点（冒泡场景可能不同）。

## 模板：template 与 include

```html
<!-- 定义 -->
<template name="userRow">
  <view>{{name}} - {{age}}</view>
</template>

<!-- 使用：data 展开传入 -->
<template is="userRow" data="{{...user}}" />
```

`template` 适合纯展示片段；逻辑复用应优先使用自定义组件（见 07 篇）。

## WXS

WXS 是运行在渲染层的脚本语言，用于在视图层做简单计算/格式化，减少逻辑层往返：

```html
<wxs module="fmt">
  module.exports = {
    toFixed: function (n) { return n.toFixed(2); }
  }
</wxs>

<text>{{fmt.toFixed(price)}}</text>
```

适用场景：过滤器格式化、手势跟随动画等对通信延迟敏感的场景。注意 WXS 与 JavaScript 语法相近但不等价，不能使用 ES6+ 大部分特性。
