# @arkmp/api

> 对外发布包

ArkMP 源码侧 API 命名空间（仿鸿蒙 kit 风格）+ `wx.*` 映射表。命名空间对象仅供 `.ets` 源码获得类型提示，所有方法在编译期被改写为 `wx.*` 调用（映射关系见 `mapping.ts`，对应设计文档 06 篇），直接运行会抛出明确错误。

## 所属层

L6 source-side（独立子树）。

## 依赖

无外部依赖（`package.json` 仅含构建/测试用 devDependencies）。本包不含 workspace 依赖，映射表为纯数据，命名空间为编译期占位实现。

## 导出 API

### 映射表与查询函数

### `getApiMapping(source: string): ApiMapping | undefined`

按源码侧 API 路径查询映射，如 `getApiMapping('http.request')`，返回对应 `ApiMapping` 或 `undefined`。

### `listApiMappings(category?: ApiCategory): readonly ApiMapping[]`

列出映射条目；可按类别过滤（`'router'` / `'system'`），缺省返回全部。

### `apiMappings: readonly ApiMapping[]`

全量映射表（路由 + 系统 + 不支持能力）。

### `routerMappings: readonly ApiMapping[]`

路由适配映射（06 篇"路由适配"表，6 条）。

### `systemMappings: readonly ApiMapping[]`

系统 API 映射（06 篇"系统 API 映射"表，14 条）。

### `unsupportedMappings: readonly ApiMapping[]`

平台能力缺失条目（06 篇），`target` 为 `null`，`fallback` 字段为 E3xxx 诊断文案来源。

### `ApiMapping`（类型）

单条映射结构，字段：`source`（源码侧 API 路径）、`signature`（签名描述）、`target`（产物 `wx.*` API 名，不支持时为 `null`）、`adapter`（参数适配方式 `direct`/`wrap`/`unsupported`）、`runtimeBridge`（是否依赖 `@arkmp/runtime` 桥接）、`note`（适配说明）、`fallback?`（降级诊断与替代建议）、`category`（`'router' | 'system'`）。

### `ApiCategory`（类型）

`'router' | 'system'`。

### `ParamAdapter`（类型）

`'direct' | 'wrap' | 'unsupported'`。

### 源码侧命名空间

以下命名空间对象均为编译期占位实现（直接调用抛错），提供 Promise 风格的类型签名：

- `http: HttpNamespace` — `request(url, options?): Promise<HttpResponse>`（→ `wx.request`）。
- `storage: StorageNamespace` — `set(key, value)` / `get<T>(key)` / `remove(key)`（→ `wx.setStorageSync` 等，值自动 JSON 序列化）。
- `prompt: PromptNamespace` — `showToast` / `showDialog` / `showActionMenu`（→ `wx.showToast`/`wx.showModal`/`wx.showActionSheet`）。
- `media: MediaNamespace` — `pickImage(options?)` / `previewImage(urls, current?)`（→ `wx.chooseMedia`/`wx.previewImage`）。
- `location: LocationNamespace` — `getCurrent(): Promise<GeoLocation>`（→ `wx.getLocation`）。
- `share: ShareNamespace` — `share(options)`（编译为 `onShareAppMessage` 配置）。
- `auth: AuthNamespace` — `login(): Promise<LoginResult>`（→ `wx.login`）。
- `device: DeviceNamespace` — `getNetworkType(): Promise<NetworkType>`（→ `wx.getNetworkType`）。
- `pay: PayNamespace` — `request(params): Promise<void>`（→ `wx.requestPayment`）。

各命名空间的选项/返回类型（`HttpRequestOptions`、`HttpResponse`、`HttpMethod`、`ShowToastOptions`、`DialogButton`、`ShowDialogOptions`、`ShowActionMenuOptions`、`PickImageOptions`、`GeoLocation`、`ShareOptions`、`LoginResult`、`NetworkType`、`PayRequestParams` 等）均从本包导出。

## 用法示例

```ts
import { http, storage, prompt, getApiMapping } from '@arkmp/api';

// 源码侧调用（编译期被改写为 wx.*，类型提示由本包提供）
async function onLoad() {
  const res = await http.request('https://example.com', { method: 'GET' });
  await storage.set('lastStatus', res.statusCode);
  await prompt.showToast({ message: 'done' });
}

// 编译器侧查询映射
const mapping = getApiMapping('http.request');
// mapping.target === 'wx.request'，mapping.runtimeBridge === true
```

## 测试

```bash
pnpm --filter @arkmp/api test
```
