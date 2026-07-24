# 08. 常用 API

## API 风格

大部分 `wx.*` API 为回调风格（`success` / `fail` / `complete`），基础库 2.10.2+ 支持 Promise 风格（不传回调时返回 Promise）：

```js
// 回调风格
wx.request({
  url: 'https://api.example.com/list',
  success(res) { console.log(res.data); }
});

// Promise 风格（推荐，配合 async/await）
const res = await wx.request({ url: 'https://api.example.com/list' });
```

带 `Sync` 后缀的为同步 API（如 `wx.getStorageSync`）。

## 网络请求

```js
const res = await wx.request({
  url: 'https://api.example.com/users',
  method: 'POST',
  data: { page: 1 },
  header: {
    'content-type': 'application/json',
    'Authorization': 'Bearer ' + token
  },
  timeout: 10000
});
// res: { data, statusCode, header }
```

注意：

- 正式环境域名需在 mp 后台"开发管理 → 服务器域名"配置，且必须 HTTPS。
- 开发阶段可在工具中勾选"不校验合法域名"跳过。
- 并发请求数上限 10 个；大文件用 `wx.downloadFile` / `wx.uploadFile`。

## 数据缓存

```js
// 同步
wx.setStorageSync('token', 'abc123');
const token = wx.getStorageSync('token');   // 不存在返回 ''
wx.removeStorageSync('token');
wx.clearStorageSync();

// 异步
await wx.setStorage({ key: 'user', data: userInfo });
const { data } = await wx.getStorage({ key: 'user' });
```

限制：单 key 上限 1MB，总上限 10MB。缓存与用户登录态无关，同一微信用户在同一设备上持续有效。

## 登录与用户

```js
// 1. 获取临时登录凭证 code
const { code } = await wx.login();

// 2. 将 code 发给自己服务端，换取 openid + session_key（后端调用 code2Session）
await wx.request({
  url: 'https://api.example.com/login',
  method: 'POST',
  data: { code }
});

// 检查登录态是否过期
wx.checkSession({
  fail() {
    // session 过期，重新 wx.login
  }
});
```

获取用户信息：

- `wx.getUserProfile` 已废弃；现通过 `button open-type="chooseAvatar"` + 昵称输入框让用户主动填写头像昵称。
- 手机号获取：`<button open-type="getPhoneNumber" bind:getphonenumber="...">`，需企业主体小程序。

## 界面交互

```js
// 提示
wx.showToast({ title: '成功', icon: 'success' });
wx.showLoading({ title: '加载中' });
wx.hideLoading();

// 模态框
const res = await wx.showModal({
  title: '提示',
  content: '确认删除？',
  confirmText: '删除',
  confirmColor: '#e64340'
});
if (res.confirm) { /* 删除 */ }

// 底部操作菜单
const menu = await wx.showActionSheet({ itemList: ['拍照', '相册'] });
console.log(menu.tapIndex);

// 导航栏标题
wx.setNavigationBarTitle({ title: '新标题' });
```

## 媒体

```js
// 选择图片/视频
const res = await wx.chooseMedia({
  count: 9,
  mediaType: ['image'],
  sourceType: ['album', 'camera'],
  sizeType: ['compressed']
});
const tempPath = res.tempFiles[0].tempFilePath;

// 预览图片
wx.previewImage({
  current: url,
  urls: [url1, url2]
});

// 上传
const uploadRes = await wx.uploadFile({
  url: 'https://api.example.com/upload',
  filePath: tempPath,
  name: 'file'
});
```

## 位置

```js
// 需 app.json 声明权限用途：
// "permission": { "scope.userLocation": { "desc": "用于展示附近门店" } }

const loc = await wx.getLocation({ type: 'gcj02' });
console.log(loc.latitude, loc.longitude);

// 调起地图选点
const place = await wx.chooseLocation();

// 打开内置地图查看位置
wx.openLocation({ latitude: 39.9, longitude: 116.4, name: '地点名' });
```

## 分享与转发

```js
// 页面内配置（需定义 onShareAppMessage 才会显示分享菜单）
Page({
  onShareAppMessage() {
    return { title: '标题', path: '/pages/index/index?ref=share' };
  },
  onShareTimeline() {
    return { title: '朋友圈标题', query: 'ref=timeline' };
  }
});

// 主动调起分享需用 button open-type="share"
```

## 设备与系统

```js
const info = wx.getWindowInfo();    // 窗口尺寸、状态栏、安全区（替代废弃的 getSystemInfoSync）
const base = wx.getDeviceInfo();    // 设备型号、系统
const network = await wx.getNetworkType();
wx.onNetworkStatusChange(res => console.log(res.isConnected));
```

## 订阅消息

```js
await wx.requestSubscribeMessage({
  tmplIds: ['模板ID1', '模板ID2']
});
// 用户同意后，服务端可通过订阅消息接口下发通知
```

模板 ID 在 mp 后台"订阅消息"中申请；一次性订阅消息每次授权只能推送一条。
