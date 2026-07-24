# 05. 生命周期

## App 生命周期

| 回调 | 触发时机 |
| --- | --- |
| `onLaunch(options)` | 小程序初始化完成，全局只触发一次 |
| `onShow(options)` | 小程序启动，或从后台进入前台 |
| `onHide()` | 小程序从前台进入后台 |
| `onError(msg)` | 脚本错误或 API 调用失败 |
| `onPageNotFound(options)` | 打开的页面不存在（可用于重定向） |
| `onUnhandledRejection` | 未处理的 Promise 拒绝 |

`options` 中包含启动场景：`path`、`query`、`scene`（场景值，如扫码、分享卡片进入）、`shareTicket` 等。

```js
App({
  onLaunch(options) {
    console.log('场景值', options.scene);   // 1001 发现栏、1011 扫码……
  },
  onPageNotFound(options) {
    wx.redirectTo({ url: '/pages/index/index' });
  }
});
```

## Page 生命周期

| 回调 | 触发时机 |
| --- | --- |
| `onLoad(options)` | 页面加载，接收路由 query 参数；一个页面只触发一次 |
| `onShow()` | 页面显示/切入前台（每次显示都触发） |
| `onReady()` | 页面初次渲染完成 |
| `onHide()` | 页面隐藏（navigateTo 离开或切后台） |
| `onUnload()` | 页面卸载（redirectTo / navigateBack 销毁页面） |

页面行为回调：

| 回调 | 触发时机 |
| --- | --- |
| `onPullDownRefresh()` | 用户下拉刷新（需页面 json 开启 `enablePullDownRefresh`） |
| `onReachBottom()` | 页面上拉触底 |
| `onShareAppMessage(options)` | 用户点击右上角分享或 button 分享 |
| `onShareTimeline()` | 分享到朋友圈（需基础库 2.11.3+） |

```js
Page({
  data: { id: 0 },

  onLoad(options) {
    // 接收上一页传来的参数：/pages/detail/detail?id=100
    this.setData({ id: Number(options.id) });
    this.loadData();
  },

  onShow() {
    // 从子页面返回时也会触发，适合刷新数据
  },

  onPullDownRefresh() {
    this.loadData().finally(() => {
      wx.stopPullDownRefresh();   // 记得停止刷新动画
    });
  },

  onShareAppMessage() {
    return {
      title: '分享标题',
      path: '/pages/index/index?from=share'
    };
  },

  loadData() {
    return Promise.resolve();
  }
});
```

### 典型执行顺序

首次打开页面：

```text
App.onLaunch → App.onShow → Page.onLoad → Page.onShow → Page.onReady
```

`navigateTo` 打开新页面：旧页面 `onHide`，新页面走 `onLoad → onShow → onReady`。
`navigateBack` 返回：当前页 `onUnload`，上一页 `onShow`。

## Component 生命周期

自定义组件有自己的一套生命周期：

```js
Component({
  lifetimes: {
    created() {
      // 组件实例创建，此时不能调用 setData
    },
    attached() {
      // 组件进入页面节点树，常用初始化位置
    },
    ready() {
      // 组件在视图层布局完成
    },
    detached() {
      // 组件被移除，清理定时器/监听器
    }
  },

  pageLifetimes: {
    show() {
      // 组件所在页面显示
    },
    hide() {
      // 组件所在页面隐藏
    }
  }
});
```

旧式写法（`created` / `attached` 直接写在 Component 配置顶层）仍兼容，推荐使用 `lifetimes` 字段。

## 实践要点

- 页面初始化数据请求放 `onLoad`；需要每次进入都刷新的放 `onShow`。
- `onReady` 后才能可靠地查询节点信息（`wx.createSelectorQuery`）。
- 定时器、事件监听在 `onUnload` / `detached` 中务必清理，避免内存泄漏和回调错乱。
