# ArkMP 使用指南

本指南面向使用 ArkMP 编译器开发微信小程序的开发者。如果你在改造 ArkMP 编译器本身，请参阅 [09-monorepo 工程分层](arkui-miniprogram/09-monorepo.md)。

## 目录

- [安装](#安装)
- [创建工程](#创建工程)
- [开发](#开发)
- [构建](#构建)
- [渐进接入已有小程序](#渐进接入已有小程序)
- [预览与上传](#预览与上传)
- [配置参考](#配置参考)
- [产物结构](#产物结构)
- [调试与诊断](#调试与诊断)
- [IDE 支持](#ide-支持)
- [FAQ](#faq)

---

## 安装

### 全局安装（发布后）

```bash
npm install -g @arkmp/cli
```

### 从源码安装（当前阶段）

ArkMP 尚未发布到 npm，可从仓库源码使用：

```bash
git clone <repo-url> ark-mini
cd ark-mini
pnpm install && pnpm build

# 验证安装
pnpm --filter @arkmp/cli exec ark-mp --version
```

### 环境要求

| 依赖 | 最低版本 |
| --- | --- |
| Node.js | 18+ |
| pnpm（仅本地开发） | 11+ |
| 微信开发者工具 | 稳定版最新 |

---

## 创建工程

```bash
# 默认模板：最小工程（1 个页面 + 1 个组件）
ark-mp init my-app

# demo 模板：含多页面 + tabBar
ark-mp init my-app --template demo
```

生成的工程结构：

```text
my-app/
├── arkmp.config.ts          # 编译配置（见"配置参考"）
├── package.json
├── tsconfig.json             # 让 IDE 对 .ets 提供类型检查
├── src/
│   ├── app.ets               # 应用入口（App 生命周期 + 全局配置）
│   ├── pages/
│   │   └── index/
│   │       └── Index.ets     # @Entry 页面
│   ├── components/
│   │   └── UserCard.ets      # @Component 自定义组件
│   └── resources/
│       └── media/            # 图片资源，编译时拷贝到产物 assets/
└── dist/                     # 编译产物（标准小程序工程）
```

### 编写第一个页面

```ts
// src/pages/counter/Counter.ets
@Entry({ title: '计数器' })
@Component
struct Counter {
  @State count: number = 0;

  build() {
    Column({ space: 12 }) {
      Text(`点击次数：${this.count}`).fontSize(20)
      Button('加一').onClick(() => {
        this.count++;
      })
    }
    .width('100%')
    .justifyContent(FlexAlign.Center)
  }
}
```

ArkMP 支持 ArkUI 声明式语法的子集，详见 [08-语法子集与限制](arkui-miniprogram/08-limitations.md)。

---

## 开发

```bash
cd my-app
ark-mp dev
```

`dev` 模式的工作流程：

```text
保存 .ets 文件
  → ark-mp watch 增量编译（仅重编变更文件 + 依赖方）
  → 写入 dist/
  → 微信开发者工具文件监听 → 自动重新编译
  → 模拟器刷新
```

开启 `devServer.autoOpenDevtool` 后，首次编译完成会自动唤起微信开发者工具并打开 `dist/` 目录：

```ts
// arkmp.config.ts
export default defineConfig({
  // ...
  devServer: {
    autoOpenDevtool: true,
    // devtoolPath: '/Applications/wechatwebdevtools.app',  // macOS 默认
  },
});
```

> 需要在微信开发者工具中开启「设置 → 编译设置 → 文件保存自动编译」。

---

## 构建

```bash
ark-mp build
```

全量编译，清空 `dist/` 后重新生成标准小程序工程：

- 扫描 `src/` 下所有 `.ets` 文件
- `app.ets` → `app.js` / `app.json` / `app.wxss`
- `pages/**/X.ets` → `pages/x/x.{wxml,wxss,js,json}`
- `components/*.ets` → `components/`（自动在引用页面的 json 补 `usingComponents`）
- `resources/media/**` → `assets/`
- 注入 `@arkmp/runtime` 单文件到 `dist/arkmp/runtime.js`
- 产物 js 中的 `require('@arkmp/runtime')` 自动改写为相对路径

构建产物可直接用微信开发者工具打开 `dist/` 目录预览。

---

## 渐进接入已有小程序

### 组件级接入

把单个 ArkUI 组件编译为小程序自定义组件，放入既有工程：

```bash
ark-mp compile src/components/UserCard.ets --out ../existing-mp/components/
```

产物包括 `UserCard.wxml` / `.wxss` / `.js` / `.json` + `runtime.js`。在页面的 json 中注册即可使用：

```json
{
  "usingComponents": {
    "user-card": "/components/UserCard"
  }
}
```

> `runtime.js` 需拷贝一份到目标目录（compile 命令自动拷贝）。同一工程只需一份。

### 页面级接入

在既有工程中建目录作为 ArkMP 输出，再手工合并 `app.json` 的 pages 列表：

```bash
ark-mp dev --out pages-ark
```

---

## 预览与上传

### 预览二维码

```bash
ark-mp preview --appid wx1234567890abcdef
```

封装 `miniprogram-ci` 生成预览二维码。需要：

1. 在工程中安装 `miniprogram-ci`：`npm i -D miniprogram-ci`
2. 从微信公众平台下载代码上传密钥（`private.<appId>.key`），通过 `--private-key` 指定路径

### 上传代码

```bash
ark-mp upload --version 1.0.0 --desc "首次发布" --appid wx1234567890abcdef
```

可选 `--robot` 指定机器人编号（1–30，默认 1）。

---

## 配置参考

`arkmp.config.ts` 完整字段：

```ts
import { defineConfig } from '@arkmp/cli';

export default defineConfig({
  // 小程序 appId（生成 project.config.json）
  appId: 'wx1234567890abcdef',

  // 应用名（project.config.json 的 projectname）
  appName: '我的应用',

  // 编译选项
  compile: {
    unitRatio: 2,         // vp → rpx 换算系数，默认 2
    sourcemap: true,      // js 产物 sourcemap，默认 false
    minify: false,        // 构建时压缩（当前版本暂未实现）
    classPrefix: '',      // 样式类名前缀（多工程共存时防冲突）
  },

  // 全局窗口配置 → app.json.window
  window: {
    navigationBarBackgroundColor: '#ffffff',
    navigationBarTextStyle: 'black',
    backgroundColor: '#f5f5f5',
  },

  // tabBar 配置 → app.json.tabBar（pages 按 struct 名引用）
  tabBar: {
    pages: [
      { name: 'Index', text: '首页', icon: 'assets/tab/home.png' },
      { name: 'Mine', text: '我的', icon: 'assets/tab/mine.png' },
    ],
  },

  // 权限声明 → app.json.permission
  permission: {
    'scope.userLocation': { desc: '用于展示附近门店' },
  },

  // 开发服务器
  devServer: {
    autoOpenDevtool: false,     // dev 时自动唤起开发者工具
    devtoolPath: '/Applications/wechatwebdevtools.app',
  },
});
```

### 字段说明

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `appId` | `string` | — | 小程序 appId，存在时生成 `project.config.json` |
| `appName` | `string` | — | 应用名 |
| `compile.unitRatio` | `number` | `2` | vp → rpx 换算系数 |
| `compile.sourcemap` | `boolean` | `false` | js 产物是否生成 sourcemap |
| `compile.classPrefix` | `string` | — | 样式类名前缀 |
| `window` | `object` | — | 透传到 `app.json.window` |
| `tabBar` | `object` | — | pages 按 struct 名引用，映射为 tabBar.list |
| `permission` | `object` | — | 透传到 `app.json.permission` |
| `devServer.autoOpenDevtool` | `boolean` | `false` | dev 时自动唤起开发者工具 |
| `devServer.devtoolPath` | `string` | macOS 默认路径 | 开发者工具安装路径 |

---

## 产物结构

```text
dist/                          # 标准微信小程序工程
├── app.js                     # App({}) 入口
├── app.json                   # pages + window + tabBar + permission
├── app.wxss                   # 全局样式
├── project.config.json        # 工程配置（appId）
├── pages/
│   └── index/
│       ├── index.wxml         # build() → 模板
│       ├── index.wxss         # 提取的样式
│       ├── index.js           # 状态/方法 + runtime 桥接
│       └── index.json         # 页面配置 + usingComponents
├── components/
│   └── user-card/
│       ├── user-card.wxml
│       ├── user-card.wxss
│       ├── user-card.js
│       └── user-card.json
├── arkmp/
│   └── runtime.js             # @arkmp/runtime（单文件 <10KB）
└── assets/                    # 图片资源
    └── logo.png
```

> 产物是标准小程序工程：`dist/` 可直接脱离 ArkMP 用微信开发者工具维护。

---

## 调试与诊断

### sourcemap

开启 `compile.sourcemap: true` 后，js 产物带 sourcemap，微信开发者工具的 Sources 面板直接显示 `.ets` 源码。

### 编译诊断

编译错误以结构化格式输出，可直接定位到源码位置：

```text
arkmp E3001 [pages/Index.ets:24:9]
  不支持的组件：Video
  帮助：小程序端请使用 ArkMP 的 <Video> 适配组件
```

### check 命令

只跑编译期诊断，不产出文件：

```bash
ark-mp check src/
```

### doctor 命令

检查环境是否就绪：

```bash
ark-mp doctor
```

输出示例：

```text
  ✓ Node.js: v20.11.0
  ✓ 微信开发者工具 CLI: /Applications/wechatwebdevtools.app/Contents/MacOS/cli
  ✗ appId 配置: 未配置
```

---

## IDE 支持

### 类型提示

安装 `@arkmp/types` 后，`tsconfig.json` 包含 `.ets` 文件即可获得完整类型检查：

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true
  },
  "include": ["src/**/*.ets", "src/**/*.ts"]
}
```

### ESLint 检查

安装 `@arkmp/eslint-plugin`，配置 flat config：

```js
// eslint.config.js
import arkmp from '@arkmp/eslint-plugin';

export default [
  {
    plugins: { arkmp },
    rules: {
      ...arkmp.configs.recommended,
      // 或按需配置单条规则
    },
  },
];
```

在编码期即提示越界语法（不支持组件、动态属性访问等），不必等到编译。

---

## FAQ

### 产物可以脱离 ArkMP 维护吗？

可以。`dist/` 是标准小程序工程，runtime.js 无混淆、无 license 绑定。直接用微信开发者工具打开 `dist/` 即可继续开发和上传。

### runtime.js 有多大？

单文件 <10KB（gzip 后约 3.5KB），无外部依赖。只负责状态赋值 → setData 桥接、@Watch 触发与少量工具函数。

### 支持哪些 ArkUI 组件？

支持 Column / Row / Stack / Text / Button / Image / TextInput / Scroll / List 等 32 个组件，详见 [03-组件转换规则](arkui-miniprogram/03-component-mapping.md)。不支持的组件（如 Navigation、WaterFlow）编译期报错并给出替代建议。

### 不支持的语法有哪些？

ArkMP 支持 ArkTS 的一个可编译子集。越界语法在编码期（eslint-plugin）和编译期均会报错，详见 [08-语法子集与限制](arkui-miniprogram/08-limitations.md)。
