---
name: arkmp-init
description: |
  ArkMP 项目初始化与脚手架 skill。当 agent 协助使用方创建 ArkMP 工程、配置编译选项、
  或将 ArkMP 渐进接入既有小程序工程时，必须按本 skill 规定的流程与配置约定执行。
  本 skill 适用于 ark-mp init、arkmp.config.ts 配置、工程结构调整、模板选择等任务，
  不适用于编译器本身的开发任务。
---

# arkmp-init — 项目初始化与脚手架

## 1. 原则声明

> **工程结构即契约**：ArkMP 工程结构是编译器与产物之间的约定。使用方的工程必须符合
> ArkMP 约定的目录结构与配置格式，否则编译器无法正确识别入口、页面、组件与资源。

Agent 协助使用方初始化工程时，必须：

1. 确认使用方的使用场景（全新工程 vs 渐进接入既有小程序）；
2. 选择正确的命令与模板；
3. 确保配置文件（`arkmp.config.ts`）的关键字段正确填写；
4. 验证环境就绪（Node.js ≥18、微信开发者工具 CLI）。

## 2. 适用判断

| 场景 | 适用 | 说明 |
| --- | --- | --- |
| 从零创建 ArkMP 工程 | ✅ | `ark-mp init` |
| 配置 `arkmp.config.ts` | ✅ | 编译选项、窗口、tabBar、权限 |
| 渐进接入既有小程序 | ✅ | `ark-mp compile` 单文件模式 |
| 工程结构调整（新增页面/组件） | ✅ | 目录约定 |
| 编译器开发 | ❌ | 属于 packages/ 开发，不适用本 skill |
| 纯文档问题 | ❌ | — |

## 3. 两种使用方式

### 3.1 全量工程模式（推荐新项目）

```bash
# 创建工程
ark-mp init my-app
ark-mp init my-app --template demo     # 带示例页面 + tabBar

# 进入工程
cd my-app
pnpm install

# 开发
ark-mp dev                             # watch 编译 + 唤起微信开发者工具

# 构建
ark-mp build                           # 完整编译 + 压缩，输出 dist/

# 诊断
ark-mp doctor                          # 检查环境
ark-mp check src/                      # 只跑编译期诊断，不产出
```

### 3.2 单文件嵌入模式（渐进接入已有小程序）

```bash
# 把单个 .ets 组件编译为小程序自定义组件
ark-mp compile src/components/UserCard.ets \
  --out ../existing-mp/components/ \
  --runtime-path ../existing-mp/arkmp/runtime.js
```

产物是标准小程序自定义组件（wxml/wxss/js/json），在既有工程的页面 json 中注册即可使用：

```json
{
  "usingComponents": {
    "user-card": "/components/UserCard/UserCard"
  }
}
```

注意：组件产物依赖 `runtime.js`，编译时自动拷贝一份到 `--runtime-path` 指定目录。

## 4. 工程目录结构

`ark-mp init` 生成的工程结构：

```text
my-app/
├── arkmp.config.ts            # 编译配置（必须）
├── package.json
├── tsconfig.json              # 让 IDE 对 .ets 提供类型检查
├── src/
│   ├── app.ets                # 应用入口（App 生命周期 + 全局配置）
│   ├── pages/                 # @Entry 页面，每页一个目录
│   │   ├── index/
│   │   │   └── Index.ets
│   │   └── detail/
│   │       └── Detail.ets
│   ├── components/            # @Component 自定义组件
│   │   └── UserCard.ets
│   ├── api/                   # 业务请求（纯 TS，可直接复用）
│   └── resources/
│       ├── base/element/      # 颜色/字符串/尺寸资源
│       └── media/             # 图片，编译时拷贝到产物 assets/
└── dist/                      # 编译产物（标准小程序工程）
```

### 目录约定（编译器依赖）

| 目录/文件 | 作用 | 约定 |
| --- | --- | --- |
| `src/app.ets` | 应用入口 | 编译器特殊处理，生成 `app.js` + `app.json` |
| `src/pages/<name>/<Name>.ets` | 页面 | 每个含 `@Entry` 的文件是一个页面 |
| `src/components/<Name>.ets` | 组件 | 每个含 `@Component` 的文件是一个自定义组件 |
| `src/resources/base/element/` | 资源 | `$r('app.color.xxx')` 引用，编译期读取 |
| `src/resources/media/` | 媒体 | `$r('app.media.xxx')` 引用，拷贝到产物 `assets/` |

### 新增页面步骤

1. 在 `src/pages/` 下新建目录（如 `profile/`）；
2. 创建 `.ets` 文件（如 `Profile.ets`），加上 `@Entry` 装饰器；
3. 页面自动被编译器收集到 `app.json.pages`，无需手动注册。

### 新增组件步骤

1. 在 `src/components/` 下创建 `.ets` 文件（如 `UserAvatar.ets`）；
2. 加上 `@Component` 装饰器；
3. 在页面或其他组件中直接按类名引用即可。

## 5. 配置文件 `arkmp.config.ts`

### 完整配置示例

```ts
import { defineConfig } from '@arkmp/cli';

export default defineConfig({
  appId: 'wx1234567890abcdef',        // 生成 project.config.json（必须）
  appName: '我的应用',                  // 应用名称

  compile: {
    unitRatio: 2,                     // vp → rpx 换算系数（默认 2）
    sourcemap: true,                  // js 产物 sourcemap（默认 false）
    minify: true,                     // 构建时压缩（默认 false）
    classPrefix: '',                  // 样式类名前缀（多工程共存时防冲突）
  },

  window: {                           // 全局窗口配置 → app.json.window
    navigationBarBackgroundColor: '#ffffff',
    navigationBarTextStyle: 'black',
    backgroundColor: '#f5f5f5'
  },

  tabBar: {                           // → app.json.tabBar
    pages: [
      { name: 'Index', text: '首页', icon: 'assets/tab/home.png' },
      { name: 'Mine', text: '我的', icon: 'assets/tab/mine.png' }
    ]
  },

  permission: {                       // → app.json.permission
    'scope.userLocation': { desc: '用于展示附近门店' }
  },

  devServer: {
    autoOpenDevtool: true,            // dev 时自动唤起微信开发者工具
    devtoolPath: '/Applications/wechatwebdevtools.app'
  }
});
```

### 关键字段说明

| 字段 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `appId` | ✅ | — | 微信小程序 AppID，生成 `project.config.json` |
| `appName` | ✅ | — | 应用名称 |
| `compile.unitRatio` | ❌ | `2` | vp → rpx 换算系数 |
| `compile.sourcemap` | ❌ | `false` | 是否生成 JS sourcemap |
| `compile.minify` | ❌ | `false` | 构建时是否压缩 |
| `compile.classPrefix` | ❌ | `''` | 样式类名前缀 |
| `window` | ❌ | — | 全局窗口配置 |
| `tabBar` | ❌ | — | TabBar 配置 |
| `permission` | ❌ | — | 权限声明 |
| `devServer` | ❌ | — | 开发服务器配置 |

### 配置校验

- 配置文件加载失败 → 诊断码 `E7001`
- 配置导出非对象 → 诊断码 `E7002`
- 字段类型不合法 → 诊断码 `E7003`，回退默认值
- 未知字段 → 警告码 `W7001`，忽略该字段

## 6. CLI 命令速查

| 命令 | 作用 | 关键选项 |
| --- | --- | --- |
| `ark-mp init <name>` | 创建工程 | `--template <default\|demo>` |
| `ark-mp dev` | watch 编译 + 唤起开发者工具 | — |
| `ark-mp build` | 完整编译 + 压缩 | — |
| `ark-mp compile <file>` | 单文件编译 | `--out <dir>`, `--runtime-path <path>` |
| `ark-mp check <dir>` | 只跑编译期诊断 | — |
| `ark-mp preview` | 生成预览二维码 | `--appid`, `--desc`, `--private-key` |
| `ark-mp upload` | 上传代码 | `--version`, `--appid`, `--desc`, `--private-key`, `--robot` |
| `ark-mp doctor` | 环境检查 | — |

## 7. 模板说明

### default 模板（默认）

最小工程，包含：
- 一个 `@Entry` 页面（`Index.ets`），含 `@State count` 计数器示例
- 一个 `@Component` 组件（`UserCard.ets`），演示 props 传递
- 基础 `arkmp.config.ts` 配置

### demo 模板

在 default 基础上增加：
- **tabBar** 配置（首页 + 我的）
- 多页面：详情页（`Detail.ets`）、我的页（`Mine.ets`）
- 演示页面间导航

## 8. 环境检查

使用 `ark-mp doctor` 检查环境就绪状态：

| 检查项 | 要求 | 不满足时 |
| --- | --- | --- |
| Node.js | ≥ 18 | 提示升级 |
| 微信开发者工具 CLI | 已安装且可调用 | 提示安装路径配置 |
| appId | `arkmp.config.ts` 中已填写 | 提示填写 |

Agent 协助使用方时，应先建议运行 `ark-mp doctor` 确认环境。

## 9. 产物说明

编译产物（`dist/`）是**标准小程序工程**，可直接用微信开发者工具打开：

```text
dist/
├── app.js                     # 由 app.ets 生成
├── app.json
├── app.wxss
├── pages/
│   └── index/
│       ├── index.wxml
│       ├── index.wxss
│       ├── index.js
│       └── index.json
├── components/                # 自定义组件产物
└── arkmp/
    └── runtime.js             # @arkmp/runtime（单文件，<10KB）
```

**产物 eject 承诺**：`dist/` 可直接脱离 ArkMP 用微信开发者工具维护。runtime.js 无混淆、无 license 绑定。

## 10. 与既有小程序工程共存

两种共存姿势：

### 组件级共存

用 `ark-mp compile` 把单个 `.ets` 编译为自定义组件，拷入既有工程，在页面 json 的 `usingComponents` 注册。

### 页面级共存

在既有工程中建 `pages-ark/` 目录作为 ArkMP 输出目录，`ark-mp dev --out pages-ark`，既有 `app.json` 手工合并 pages 列表。

共存时 runtime 只保留一份（通过 `--runtime-path` 指定）。

## 11. 检查清单

初始化工程后，确认以下事项：

- [ ] `ark-mp doctor` 通过（Node.js ≥18、开发者工具 CLI 可用、appId 已填）
- [ ] `arkmp.config.ts` 中 `appId` 和 `appName` 已正确填写
- [ ] `src/app.ets` 存在且包含应用入口逻辑
- [ ] 至少有一个 `@Entry` 页面
- [ ] `ark-mp dev` 能正常启动并编译
- [ ] `dist/` 目录生成了完整的小程序工程
- [ ] 微信开发者工具能打开 `dist/` 且模拟器正常渲染
