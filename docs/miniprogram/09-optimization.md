# 09. 分包与性能优化

## 包体积限制

- 单个分包 / 主包：不超过 **2MB**
- 整包（主包 + 所有分包）：不超过 **30MB**（以官方最新公告为准）

超限无法上传。主包包含启动页和 tab 页，应尽量精简。

## 分包配置

在 `app.json` 中声明 `subpackages`：

```json
{
  "pages": [
    "pages/index/index",
    "pages/mine/mine"
  ],
  "subpackages": [
    {
      "root": "packageOrder",
      "name": "order",
      "pages": [
        "pages/list/list",
        "pages/detail/detail"
      ]
    },
    {
      "root": "packageGoods",
      "pages": [
        "pages/detail/detail"
      ]
    }
  ],
  "preloadRule": {
    "pages/index/index": {
      "network": "wifi",
      "packages": ["order"]
    }
  }
}
```

规则：

- 分包页面路径为 `root + 页面路径`，如 `/packageOrder/pages/list/list`。
- 主包无法引用分包内的文件（js、组件、资源）；分包之间也不能互相引用，公共资源放主包。
- 分包内可再声明自己的 `usingComponents`，组件文件须在本分包内。
- `preloadRule` 配置进入某页面时在后台预下载指定分包，减少首次进入分包页面的等待。

### 独立分包

不依赖主包即可运行的分包（如广告落地页）：

```json
{
  "subpackages": [
    {
      "root": "packageAd",
      "independent": true,
      "pages": ["pages/landing/landing"]
    }
  ]
}
```

独立分包内不能使用主包的资源与 `getApp()`（主包未加载时），仅适合完全独立的场景。

## setData 优化

`setData` 是逻辑层到渲染层的通信，是小程序性能的第一瓶颈。

### 1. 只传变化的数据

```js
// ❌ 全量覆盖大对象
this.setData({ user: newUser });

// ✅ 路径精准更新
this.setData({ 'user.name': '新名字' });
```

### 2. 高频更新节流

滚动跟随、拖拽等场景，setData 调用频率控制在合理范围（如 ≥50ms 一次），或改用 WXS 在渲染层处理。

### 3. 与视图无关的数据不要放 data

```js
Page({
  data: { visibleList: [] },

  onLoad() {
    // ❌ 放入 data 会导致每次 setData 都可能参与序列化比较
    // this.setData({ fullList: bigList });

    // ✅ 挂在 this 上，不参与视图渲染
    this.fullList = bigList;
  }
});
```

### 4. 长列表优化

- 分页加载（`onReachBottom`），不复用一次性全量渲染。
- 图片用 `lazy-load`：`<image lazy-load src="..." />`。
- 超长列表考虑 `recycle-view` 组件或 IntersectionObserver 控制渲染。
- 删除不可见项的 `wx:if` 比 `hidden` 更省渲染节点。

## 首屏优化

- 主包只放启动必需页面与公共资源，其余全部分包。
- 首屏接口尽早发出（`onLoad` 立即请求，不要等 `onReady`）。
- 骨架屏：先渲染静态占位结构，数据到达后替换。
- 图片使用 CDN + 合适尺寸（不要拿原图缩略展示），格式优先 webp。
- 开启开发者工具的"上传时压缩混淆"，并在 Audits 面板跑体验评分逐项整改。

## 启动性能

- `onLaunch` 中避免同步重活（大循环、大量 storage 读写），非必要初始化延后。
- 使用按需注入（app.json 中 `"lazyCodeLoading": "requiredComponents"`，基础库默认开启新工程）：页面 js 只在打开时注入执行。
- 控制全局 `usingComponents` 数量（app.json 里注册的全局组件会进入所有页面）。

## 包体积瘦身

- 图片资源放 CDN，小程序内不留大图；必须内置的图标用 iconfont 或压缩后的 png/webp。
- 清理未使用的页面、组件、样式（工具"代码依赖分析"可查未引用文件）。
- node_modules 只打包运行时依赖（构建型小程序用 miniprogram-ci 或工具 npm 构建，勿把开发依赖打进包）。

## 性能检测工具

- 开发者工具：**Audits 体验评分**、Trace 性能面板、AppData 面板。
- 真机：`wx.getPerformance()` 获取启动耗时、路由耗时、setData 耗时等指标，可上报自建监控。
- 微信官方"小程序测速"与运维中心：真实用户性能数据、错误日志、告警。
