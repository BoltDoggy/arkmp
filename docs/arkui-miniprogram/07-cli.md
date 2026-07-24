# 07. 工程与 CLI 设计

## 源码工程结构（ark-mp init 生成）

```text
my-app/
├── arkmp.config.ts            # 编译配置
├── package.json
├── tsconfig.json              # 让 IDE 对 .ets 提供类型检查
├── src/
│   ├── app.ets                # 应用入口（App 生命周期 + 全局配置）
│   ├── pages/
│   │   ├── index/
│   │   │   └── Index.ets      # @Entry 页面
│   │   └── detail/
│   │       └── Detail.ets
│   ├── components/
│   │   └── UserCard.ets       # @Component 自定义组件
│   ├── api/                   # 业务请求（纯 TS，可直接复用）
│   └── resources/
│       ├── base/element/      # 颜色/字符串/尺寸资源（沿用 ArkUI 约定）
│       └── media/             # 图片，编译时拷贝到产物 assets/
└── dist/                      # 编译产物（标准小程序工程，开发者工具直接打开）
```

IDE 支持：提供 `@arkmp/types` 类型包（装饰器、组件、API 的 d.ts），配合 tsconfig 的 `include: ["src/**/*.ets"]`，使 DevEco Studio 或 VS Code 均可获得完整类型提示——源码即合法 ArkUI 子集。

## 配置文件 arkmp.config.ts

```ts
import { defineConfig } from '@arkmp/cli';

export default defineConfig({
  appId: 'wx1234567890abcdef',        // 生成 project.config.json
  appName: '我的应用',

  compile: {
    unitRatio: 2,                     // vp → rpx 换算系数
    sourcemap: true,                  // js 产物 sourcemap
    minify: true,                     // 构建时压缩
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
    devtoolPath: '/Applications/wechatwebdevtools.app'  // macOS 示例
  }
});
```

## CLI 命令

```bash
# 创建工程
ark-mp init my-app
ark-mp init my-app --template demo     # 带示例页面

# 开发：watch 编译，输出到 dist/ 并唤起开发者工具
ark-mp dev

# 构建：完整编译 + 压缩
ark-mp build

# 单文件编译（渐进接入已有小程序工程）
ark-mp compile src/components/UserCard.ets --out ../existing-mp/components/

# 预览/上传（封装微信 miniprogram-ci）
ark-mp preview                         # 生成预览二维码
ark-mp upload --version 1.0.0 --desc "首次发布"

# 诊断
ark-mp doctor                          # 检查环境（node、开发者工具 CLI、appId）
ark-mp check src/                      # 只跑编译期诊断，不产出
```

## 编译输出与调试链路

### dev 模式

```text
保存 .ets 文件
  → ark-mp watch 增量编译（仅重编变更文件 + 依赖方）
  → 写入 dist/
  → 微信开发者工具文件监听自动重新编译
  → 模拟器刷新（开发工具"自动保存编译"开启时）
```

### sourcemap 与错误定位

- js 产物带 sourcemap，开发者工具 Sources 面板直接显示 `.ets` 源码。
- 编译诊断以源码位置报告（见 02 篇诊断格式）。
- runtime 错误在 console 中带 `[arkmp]` 前缀与组件名，便于定位。

### 产物 eject

产物就是标准小程序工程：`dist/` 可直接脱离 ArkMP 用微信开发者工具维护。这是明确的设计承诺——runtime.js 无混淆、无 license 绑定，团队可以随时"下车"。

## 与既有小程序工程共存（渐进接入）

两种共存姿势：

1. **组件级**：`ark-mp compile` 把单个 `.ets` 组件编译为小程序自定义组件，拷入既有工程，在页面 json 的 `usingComponents` 注册即可。组件产物依赖 runtime.js（编译时自动拷贝一份到指定目录）。
2. **页面级**：在既有工程中建 `pages-ark/` 目录作为 ArkMP 输出目录，`ark-mp dev --out pages-ark`，既有 app.json 手工合并 pages 列表。

注意：共存时 ArkMP 产物与手写代码共享小程序包体积，runtime 只保留一份（`--runtime-path` 指定）。

## npm 包规划

对外发布的包（实现按 pnpm monorepo 组织，内部还有更细粒度的 private 包，完整分层见 [09-monorepo 工程分层](09-monorepo.md)）：

| 包 | 职责 |
| --- | --- |
| `@arkmp/cli` | 命令行、工程脚手架、watch/build 调度 |
| `@arkmp/compiler` | 编译内核（parse/analyze/IR/transform/emit），可被 CLI 与插件复用 |
| `@arkmp/runtime` | 产物运行时（注入 dist，单文件） |
| `@arkmp/types` | .ets 源码的类型定义（装饰器、组件、API） |
| `@arkmp/api` | 源码侧 API 命名空间（编译期映射为 wx.*） |
| `@arkmp/eslint-plugin` | 源码约束检查（越界语法在编码期就提示，不必等到编译） |

## 测试策略

- **编译器**：快照测试——一组覆盖各语法点的 `.ets` fixture，编译产物与快照比对。
- **转换规则**：03–06 篇每条规则对应至少一个 fixture 用例（规则文档即测试清单）。
- **产物行为**：用 miniprogram-simulate 在 node 环境跑产物组件的行为测试（状态赋值 → data 变化 → @Watch 触发）。
- **端到端**：CI 中用 miniprogram-automator 驱动真实开发者工具跑核心 demo 流程。
