# ark-mini

> 用 ArkUI 语法开发微信小程序 —— ArkMP 编译工具的设计文档与完整实现。

ArkMP 是一个类似 Taro 的构建工具，但输入端是 ArkUI / ArkTS 声明式语法（`@Entry`、`@Component`、`@State`、`build()` 链式 UI 描述），输出端**只输出微信小程序**工程（WXML / WXSS / JS / JSON + `@arkmp/runtime` 轻量运行时）。编译期把转换做"深"——build() 直出 WXML，运行时只负责状态桥接。

```text
.ets 源码  →  ArkMP 编译器  →  标准微信小程序工程
              parse → analyze → IR → transform → emit
```

## 使用

### 安装

```bash
# 全局安装（发布后可用）
npm install -g @arkmp/cli

# 或在已有工程中安装
npm install --save-dev @arkmp/cli
```

当前尚未发布到 npm，可从源码安装：

```bash
git clone <repo-url> ark-mini
cd ark-mini
pnpm install && pnpm build
# 之后通过 node packages/cli/cli/dist/cli.js 或 link 后使用 ark-mp 命令
pnpm --filter @arkmp/cli exec ark-mp --version
```

### 运行

```bash
# 创建工程
ark-mp init my-app [--template demo]

# 进入工程目录
cd my-app

# 开发：watch 编译 + 自动唤起微信开发者工具
ark-mp dev

# 构建：全量编译，输出标准小程序工程到 dist/
ark-mp build

# 单文件编译（渐进接入已有小程序）
ark-mp compile src/components/UserCard.ets --out ../existing-mp/components/

# 只跑诊断，不产出
ark-mp check src/

# 预览二维码 / 上传代码 / 环境检查
ark-mp preview
ark-mp upload --version 1.0.0 --desc "首次发布"
ark-mp doctor
```

开发模式下保存 `.ets` 文件即触发增量编译，产物写入 `dist/`，微信开发者工具自动刷新预览。产物是标准小程序工程，可随时脱离 ArkMP 直接用开发者工具维护（eject 友好）。

## 本地开发

```bash
pnpm install        # 安装 workspace 依赖
pnpm build          # 全量构建（27 个包）
pnpm test           # 全量测试（358 个测试）
pnpm typecheck      # 全量类型检查
```

需要 pnpm ≥ 11、Node ≥ 18。

单包开发：

```bash
pnpm --filter @arkmp/pipeline test          # 跑单个包的测试
pnpm --filter @arkmp/transform-wxml build   # 构建单个包
```

## 目录结构

```text
ark-mini/
├── packages/
│   ├── core/                    # L0 基础层
│   │   ├── shared/              #   @arkmp/shared — 工具函数
│   │   ├── diagnostics/         #   @arkmp/diagnostics — 诊断模型
│   │   └── ir/                  #   @arkmp/ir — 中间表示（零依赖）
│   ├── frontend/                # L1 源码 → IR
│   │   ├── parser/              #   @arkmp/parser — struct 预处理 + TS AST
│   │   └── analyzer/            #   @arkmp/analyzer — AST → ComponentModel
│   ├── transforms/              # L2 IR → 产物片段（四条链）
│   │   ├── mapping-components/  #   组件映射表（纯数据）
│   │   ├── mapping-styles/      #   样式白名单 + 单位换算（纯数据）
│   │   ├── transform-wxml/      #   buildTree → WXML
│   │   ├── transform-wxss/      #   styleCalls → WXSS
│   │   ├── transform-js/        #   states/props → data/桥接
│   │   ├── transform-events/    #   eventCalls → 事件表
│   │   └── transform-json/      #   装饰器参数 → json 配置
│   ├── backend/
│   │   └── emitter/             #   @arkmp/emitter — 四件套拼装 + sourcemap
│   ├── compiler/                # L4 编译内核
│   │   ├── pipeline/            #   @arkmp/pipeline — 单文件纯函数编排
│   │   ├── dep-graph/           #   @arkmp/dep-graph — 组件依赖图
│   │   ├── incremental/         #   @arkmp/incremental — 哈希缓存
│   │   ├── watcher/             #   @arkmp/watcher — 文件监听
│   │   └── compiler/            #   @arkmp/compiler ★ 工程级编译入口
│   ├── runtime/
│   │   └── runtime/             #   @arkmp/runtime ★ 产物运行时（单文件 <10KB）
│   ├── source-side/             # L6 源码侧支撑
│   │   ├── types/               #   @arkmp/types ★ .ets 类型定义
│   │   ├── api/                 #   @arkmp/api ★ 源码侧 API + wx.* 映射
│   │   └── eslint-plugin/       #   @arkmp/eslint-plugin ★ 编码期检查
│   ├── cli/                     # L7 命令行
│   │   ├── config/              #   @arkmp/config — arkmp.config.ts 加载
│   │   ├── templates/           #   @arkmp/templates — init 脚手架模板
│   │   ├── devtool/             #   @arkmp/devtool — 开发者工具封装
│   │   └── cli/                 #   @arkmp/cli ★ 命令行入口（bin: ark-mp）
│   └── testing/
│       └── test-utils/          #   @arkmp/test-utils — fixture 加载辅助
├── e2e/                         # 端到端测试（demo 工程 build + runtime 行为 + CI 验证）
└── docs/                        # 文档
    ├── guide.md                 #   使用指南（安装、运行、配置、调试）
    ├── arkui/                   #   ArkUI 参考文档（9 篇）
    ├── miniprogram/             #   微信小程序参考文档（9 篇）
    └── arkui-miniprogram/       #   ArkMP 设计文档（10 篇）
```

> ★ 标记为对外发布包（6 个），其余为内部 private 包。

## 编译管线

```text
.ets 源码
   │
   ① parse            struct→class 预处理 + TS Compiler API 解析为 AST
   ▼
   ② analyze          提取组件模型：装饰器、状态字段、生命周期、build() 结构
   ▼
   ③ IR               ComponentModel { state, props, lifecycle, uiTree, styles, events }
   ▼
   ④ transform        四条并行链：
                     ├─ uiTree   → WXML（组件映射 + wx:if/wx:for）
                     ├─ styles   → WXSS + 内联 style
                     ├─ state    → data + __set 桥接
                     └─ events   → bind/catch 事件表
   ▼
   ⑤ emit             生成 wxml/wxss/js/json，注入 runtime，写入 dist/
```

## 文档

- **[使用指南](docs/guide.md)** — 安装、创建工程、开发、构建、渐进接入、配置参考、调试

### 设计文档（`docs/arkui-miniprogram/`）

| 文档 | 内容 |
| --- | --- |
| [01-总体设计](docs/arkui-miniprogram/01-overview.md) | 架构总览、编译管线、目录与产物结构 |
| [02-编译流程](docs/arkui-miniprogram/02-pipeline.md) | 解析、IR、各转换阶段、代码生成详设 |
| [03-组件转换规则](docs/arkui-miniprogram/03-component-mapping.md) | ArkUI 组件 → WXML 映射表 |
| [04-样式转换规则](docs/arkui-miniprogram/04-style-mapping.md) | 链式样式 → WXSS、单位换算 |
| [05-状态与生命周期](docs/arkui-miniprogram/05-state-lifecycle-mapping.md) | 装饰器 → data/setData 桥接 |
| [06-运行时与 API 适配](docs/arkui-miniprogram/06-api-mapping.md) | runtime 库设计、wx.* API 映射 |
| [07-工程与 CLI](docs/arkui-miniprogram/07-cli.md) | 项目结构、配置文件、命令清单 |
| [08-语法子集与限制](docs/arkui-miniprogram/08-limitations.md) | 支持的 ArkTS 子集、诊断策略 |
| [09-monorepo 工程分层](docs/arkui-miniprogram/09-monorepo.md) | pnpm monorepo、package 原子化划分 |

## 技术栈

- **语言**：TypeScript 5.9
- **包管理**：pnpm 11 workspace
- **构建**：tsdown（ESM/CJS 双格式 + d.ts）
- **测试**：Vitest 4
- **CLI**：cac 6
- **运行时**：自研单文件 <10KB，无外部依赖
