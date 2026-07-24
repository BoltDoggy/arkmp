# 02. 工程结构与配置

## 目录结构

```text
project/
├── miniprogram/               # 小程序代码目录（可在 project.config.json 中配置）
│   ├── app.js                 # 小程序逻辑入口（App()）
│   ├── app.json               # 全局配置
│   ├── app.wxss               # 全局样式
│   ├── pages/                 # 页面，每个页面一个目录
│   │   └── index/
│   │       ├── index.js       # 页面逻辑（Page()）
│   │       ├── index.json     # 页面配置
│   │       ├── index.wxml     # 页面结构
│   │       └── index.wxss     # 页面样式
│   ├── components/            # 自定义组件
│   └── utils/                 # 工具函数
├── project.config.json        # 项目配置（开发者工具）
└── sitemap.json               # 收录配置（是否允许被微信搜索索引）
```

## app.json：全局配置

```json
{
  "pages": [
    "pages/index/index",
    "pages/detail/detail"
  ],
  "window": {
    "navigationBarBackgroundColor": "#ffffff",
    "navigationBarTitleText": "首页",
    "navigationBarTextStyle": "black",
    "backgroundColor": "#f5f5f5",
    "enablePullDownRefresh": false
  },
  "tabBar": {
    "color": "#999999",
    "selectedColor": "#07c160",
    "list": [
      {
        "pagePath": "pages/index/index",
        "text": "首页",
        "iconPath": "assets/tab/home.png",
        "selectedIconPath": "assets/tab/home_active.png"
      },
      {
        "pagePath": "pages/mine/mine",
        "text": "我的",
        "iconPath": "assets/tab/mine.png",
        "selectedIconPath": "assets/tab/mine_active.png"
      }
    ]
  },
  "style": "v2",
  "sitemapLocation": "sitemap.json"
}
```

要点：

- `pages` 第一项是小程序启动页；新增页面必须在这里注册。
- `tabBar` 最多 5 个 tab；tab 页只能 `wx.switchTab` 进入。
- `window` 控制导航栏、背景、下拉刷新等全局窗口表现。

## 页面 json：页面级配置

每个页面的 `.json` 覆盖全局 `window` 配置：

```json
{
  "navigationBarTitleText": "详情",
  "enablePullDownRefresh": true,
  "usingComponents": {
    "user-card": "/components/user-card/user-card"
  }
}
```

`usingComponents` 声明页面引用的自定义组件，路径支持绝对路径（`/` 开头）和相对路径。

## app.js：全局逻辑

```js
App({
  globalData: {
    userInfo: null,
    token: ''
  },

  onLaunch(options) {
    // 小程序初始化完成时触发（全局只触发一次）
    console.log('启动参数', options.query, options.scene);
  },

  onShow(options) {
    // 小程序启动或从后台进入前台
  },

  onHide() {
    // 从前台进入后台
  },

  onError(msg) {
    // 全局错误监听
    console.error(msg);
  }
});
```

页面中通过 `getApp()` 获取 App 实例访问 `globalData`：

```js
const app = getApp();
console.log(app.globalData.token);
```

## project.config.json

开发者工具的项目配置，常用字段：

```json
{
  "appid": "wx1234567890abcdef",
  "projectname": "my-miniprogram",
  "miniprogramRoot": "miniprogram/",
  "compileType": "miniprogram",
  "setting": {
    "es6": true,
    "postcss": true,
    "minified": true,
    "urlCheck": true
  }
}
```

`urlCheck: true` 时工具会校验 request 域名合法性，发布前需在 mp 后台配置服务器域名。

## 其他配置文件

- **sitemap.json**：控制页面是否允许被微信搜一搜索引。
- **ext.json**：第三方平台代开发时的扩展配置。

## 环境版本判断

```js
const { miniProgram } = wx.getAccountInfoSync();
console.log(miniProgram.envVersion);  // develop | trial | release
```

常用于区分开发/体验/正式环境，切换接口域名。
