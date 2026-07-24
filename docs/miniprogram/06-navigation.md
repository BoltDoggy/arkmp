# 06. 页面路由与传参

## 路由 API

| API | 行为 | 页面栈变化 |
| --- | --- | --- |
| `wx.navigateTo` | 打开新页面（保留当前页，可返回） | 入栈 |
| `wx.redirectTo` | 关闭当前页，打开新页面 | 栈顶替换 |
| `wx.reLaunch` | 关闭所有页面，打开指定页 | 清空后入栈 |
| `wx.switchTab` | 切换到 tab 页（关闭其他非 tab 页） | 清空，仅保留 tab 页 |
| `wx.navigateBack` | 返回上一页或多级页面 | 出栈 |

```js
// 打开详情页并传参
wx.navigateTo({
  url: '/pages/detail/detail?id=100&from=home'
});

// 返回上一页
wx.navigateBack();

// 返回上两级
wx.navigateBack({ delta: 2 });

// 重启动到登录页（清空页面栈）
wx.reLaunch({ url: '/pages/login/login' });

// 切换 tab（不能带参数！）
wx.switchTab({ url: '/pages/mine/mine' });
```

注意：

- 页面栈最多 10 层，层级过深时 `navigateTo` 会失败，需用 `redirectTo` 或 `reLaunch`。
- `switchTab` 的 url 不能带 query 参数，给 tab 页传值需借助全局数据或 storage。

## 声明式跳转：navigator 组件

```html
<navigator url="/pages/detail/detail?id={{item.id}}" open-type="navigate">
  查看详情
</navigator>

<navigator url="/pages/mine/mine" open-type="switchTab">去我的</navigator>
```

`open-type` 对应各路由 API，另有 `exit`（退出小程序）、`navigateBack`。

## 接收参数

目标页面在 `onLoad(options)` 中获取 query：

```js
Page({
  onLoad(options) {
    const id = Number(options.id);
    const from = options.from || '';
  }
});
```

## 页面间通信

### 上一页 → 下一页：url query

适合少量简单数据。复杂对象需 `encodeURIComponent(JSON.stringify(obj))` 编码，目标页解码。

### 下一页 → 上一页：EventChannel（推荐）

```js
// 上一页：打开时监听事件
wx.navigateTo({
  url: '/pages/select/select',
  events: {
    onSelect(data) {
      console.log('子页面回传', data);
    }
  }
});
```

```js
// 子页面：获取 EventChannel 并回传
Page({
  onLoad() {
    const eventChannel = this.getOpenerEventChannel();
    eventChannel.emit('onSelect', { value: '选中的数据' });
    wx.navigateBack();
  }
});
```

### 通过全局数据 / Storage

```js
// 全局
getApp().globalData.selectedCity = city;

// 或本地缓存
wx.setStorageSync('selectedCity', city);
```

适合登录态、跨多页共享的数据；注意 storage 有大小限制（单个 key 1MB，总 10MB）。

### 直接操作页面栈中的页面实例

```js
const pages = getCurrentPages();
const prevPage = pages[pages.length - 2];
prevPage.setData({ refresh: true });
wx.navigateBack();
```

可行但耦合强，仅简单场景使用，优先 EventChannel。

## 路由拦截（登录守卫）

小程序没有全局路由钩子，常见做法：

1. 封装统一的 `navigateTo` 方法，在其中校验登录态，未登录则 `navigateTo` 到登录页。
2. 或在敏感页面 `onLoad`/`onShow` 中检查，未登录 `redirectTo` 登录页，登录成功后回跳。

```js
// utils/router.js
export function navTo(url) {
  const token = wx.getStorageSync('token');
  const needAuth = url.startsWith('/pages/order') || url.startsWith('/pages/mine');
  if (needAuth && !token) {
    wx.navigateTo({
      url: '/pages/login/login?redirect=' + encodeURIComponent(url)
    });
    return;
  }
  wx.navigateTo({ url });
}
```
