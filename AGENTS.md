# AGENTS.md

本文件面向 AI 编码代理，介绍本仓库的架构、约定与开发流程。阅读本文件前无需了解任何背景。

## 项目概述

**ArkMP** 是一个编译工具：输入端是 ArkUI / ArkTS 声明式语法（`@Entry`、`@Component`、`@State`、`build()` 链式 UI 描述，文件后缀 `.ets`），输出端**只输出标准微信小程序工程**（WXML / WXSS / JS / JSON + `@arkmp/runtime` 轻量运行时）。类似 Taro，但语法来源是 ArkUI 而非 React/Vue。编译期把转换做"深"——`build()` 直出 WXML，运行时只负责状态桥接。

```text
.ets 源码  →  ArkMP 编译器  →  标准微信小程序工程
              parse → analyze → IR → transform → emit
```

仓库还包含三组中文技术文档：

- `docs/arkui/` — ArkUI 框架参考文档（编译器的**输入端**参考）。
- `docs/miniprogram/` — 微信小程序参考文档（编译器的**输出端**参考）。
- `docs/arkui-miniprogram/` — **ArkMP 设计文档**（10 篇），是 `packages/` 实现的设计依据；`09-monorepo.md` 是包划分的直接来源。

三组文档的关系：`arkui/` 描述输入端，`miniprogram/` 描述输出端，`arkui-miniprogram/` 描述从输入到输出的转换设计。实现代码放在 `packages/`，以设计文档为准。

## 目录结构

```text
ark-mini/
├── packages/                    # ArkMP 编译器实现（pnpm workspace，27 个包，按管线分 8 层）
│   ├── core/                    # L0 基础层
│   │   ├── shared/              #   @arkmp/shared — 工具函数（哈希、路径规范化、logger）
│   │   ├── diagnostics/         #   @arkmp/diagnostics — 结构化诊断模型与格式化
│   │   └── ir/                  #   @arkmp/ir — 中间表示（零依赖，不引用 ts.*）
│   ├── frontend/                # L1 源码 → IR
│   │   ├── parser/              #   @arkmp/parser — struct→class 预处理 + TS AST 解析（位置映射）
│   │   └── analyzer/            #   @arkmp/analyzer — AST → ComponentModel
│   ├── transforms/              # L2 IR → 产物片段（四条转换链 + 两个纯数据包）
│   │   ├── mapping-components/  #   @arkmp/mapping-components — 组件映射表（纯数据）
│   │   ├── mapping-styles/      #   @arkmp/mapping-styles — 样式白名单 + vp→rpx 换算（纯数据）
│   │   ├── transform-wxml/      #   @arkmp/transform-wxml — buildTree → WXML
│   │   ├── transform-wxss/      #   @arkmp/transform-wxss — styleCalls → WXSS
│   │   ├── transform-js/        #   @arkmp/transform-js — states/props → data/桥接
│   │   ├── transform-events/    #   @arkmp/transform-events — eventCalls → 事件表
│   │   └── transform-json/      #   @arkmp/transform-json — 装饰器参数 → json 配置
│   ├── backend/
│   │   └── emitter/             #   @arkmp/emitter — 四件套拼装 + sourcemap
│   ├── compiler/                # L4 编译内核
│   │   ├── pipeline/            #   @arkmp/pipeline — 单文件纯函数编译编排
│   │   ├── dep-graph/           #   @arkmp/dep-graph — 组件依赖图
│   │   ├── incremental/         #   @arkmp/incremental — 哈希缓存 + 变更判定
│   │   ├── watcher/             #   @arkmp/watcher — chokidar 封装，事件 → 增量调度
│   │   └── compiler/            #   @arkmp/compiler ★ 工程级编译入口（对外发布）
│   ├── runtime/
│   │   └── runtime/             #   @arkmp/runtime ★ 产物运行时（对外发布，单文件 <10KB）
│   ├── source-side/             # L6 源码侧支撑（独立子树）
│   │   ├── types/               #   @arkmp/types ★ .ets 类型定义（纯 d.ts，tsd 测试）
│   │   ├── api/                 #   @arkmp/api ★ 源码侧 API + wx.* 映射
│   │   └── eslint-plugin/       #   @arkmp/eslint-plugin ★ 编码期越界语法检查
│   ├── cli/                     # L7 命令行
│   │   ├── config/              #   @arkmp/config — arkmp.config.ts 加载 + schema 校验
│   │   ├── templates/           #   @arkmp/templates — init 脚手架模板（default / demo）
│   │   ├── devtool/             #   @arkmp/devtool — 开发者工具唤起 + miniprogram-ci 封装
│   │   └── cli/                 #   @arkmp/cli ★ 命令行入口（bin: ark-mp，对外发布）
│   └── testing/
│       └── test-utils/          #   @arkmp/test-utils — fixture 加载与产物比对辅助
├── e2e/                         # 端到端测试（demo 工程 build + runtime 行为 + CI 验证）
├── docs/                        # 文档（见「项目概述」三组文档 + guide.md 使用指南）
├── skills/                      # ArkMP 用户向 skills（arkmp-debug / arkmp-mapping / arkmp-init / arkui-compliant）
├── package.json                 # 根 workspace 配置
├── pnpm-workspace.yaml          # workspace 声明（packages/*/* + e2e）
├── tsconfig.base.json           # 共享 TS 编译选项（strict、ES2020、ESNext module、bundler resolution）
└── AGENTS.md                    # 本文件
```

> ★ 标记为**对外发布包**（共 6 个），其余内部包一律 `"private": true`。

## 技术栈

- **语言**：TypeScript 5.9（`strict: true`，`verbatimModuleSyntax`，`isolatedModules`）
- **运行时要求**：Node ≥ 20（package.json engines 声明 ≥ 20，README 记载 ≥ 18）
- **包管理**：pnpm 11 workspace（`packageManager: pnpm@11.17.0`）
- **构建**：tsdown 0.22（ESM + CJS 双格式 + d.ts + sourcemap）
- **测试**：Vitest 4（单测 + 快照测试）；`@arkmp/types` 用 tsd 做类型测试
- **CLI 框架**：cac 6
- **AST 解析**：TypeScript Compiler API（`typescript` 包，`struct`→`class` 预处理后解析）
- **文件监听**：chokidar（经 `@arkmp/watcher` 封装）
- **运行时**：自研单文件（<10KB 预算测试），无外部依赖

## 构建与测试

### 根级命令（按拓扑序跑全部包）

```bash
pnpm install          # 安装 workspace 依赖
pnpm build            # 全量构建（pnpm -r build）
pnpm test             # 全量测试（pnpm -r test，约 295 个测试用例 / 43 个文件）
pnpm typecheck        # 全量类型检查（pnpm -r typecheck）
```

### 单包操作

```bash
pnpm --filter @arkmp/pipeline test              # 跑单个包的测试
pnpm --filter @arkmp/transform-wxml build       # 构建单个包
```

### 端到端测试

```bash
cd e2e && pnpm test    # e2e 是独立 workspace 包，需单独跑
```

e2e 覆盖三类场景：
- **T51 runtime-behavior**：在 Node 中 mock 全局 `Page()`/`Component()`，验证 runtime 状态桥接、`@Watch`、`createComponent` 契约。
- **T52 demo-project**：构造多页面 + 自定义组件 + tabBar 的完整工程，调用 `buildProject` 全量编译，断言产物结构与关键内容。
- **T53 ci-check**：验证对外发布包可被 `require.resolve` 解析、runtime 单文件 <10KB、所有 workspace 包结构完整。

### 当前已知问题

工作区有未提交的 `transform-js` 改动，导致 `@arkmp/compiler` 的一个快照测试失败（`tests/index.test.ts > 产物内容全量快照`）。修改 `transform-js` 产物格式后需同步更新该快照（`vitest -u`）。

## 编译管线

```text
.ets 源码
   │
   ① parse            struct→class 预处理（保留位置映射）+ TS Compiler API 解析为 AST
   ▼
   ② analyze          提取组件模型：装饰器、状态字段、生命周期、build() 结构 → ComponentModel
   ▼
   ③ IR               ComponentModel { states, props, lifecycle, buildTree, styles, events }
   ▼
   ④ transform        四条并行链：
                     ├─ events   → 事件表 + 回调方法抽取（先于 js）
                     ├─ styles   → WXSS 类 + 内联兜底（先于 wxml，合并 classMap）
                     ├─ uiTree   → WXML（组件映射 + wx:if/wx:for + {{}} 绑定）
                     ├─ state    → data + __set 桥接 + createPage/createComponent
                     └─ config   → 页面/组件 json
   ▼
   ⑤ emit             生成 wxml/wxss/js/json，注入 runtime，写入 dist/
```

`@arkmp/pipeline` 的 `compile(source, options)` 是纯函数、无 I/O，是整个编译器单测的锚点。`@arkmp/compiler` 的 `buildProject(options)` 是工程级入口，负责扫描 `src/`、单文件编译、`usingComponents` 解析、runtime 注入、`app.json` 合成、增量编译与 watch。

## 架构关键点

- **IR 解耦**：`@arkmp/ir` 保持零依赖，不引用 `typescript`；所有表达式在 analyze 阶段已序列化为目标无关描述（`static` / `binding`），使 IR 与两端语法彻底解耦。
- **诊断系统**：编译期问题统一以结构化诊断报告（`Diagnostic`：level + code + file:line:column + message + help），不抛异常。`error` 级阻断构建，`warning` 级降级输出。诊断码分段：parser `E1xxx`、analyzer `E2xxx`/`W2xxx`、transforms `E3xxx`–`E6xxx`、config `E7xxx`、cli `E8xxx`。格式化输出形如 `arkmp E1023 [file.ets:24:9]`。
- **L2 各 transform 包互不依赖**：新增转换链 = 新增包，不改兄弟包。events 先于 js（其 methods 作为 transformJs 的 eventMethods 传入），wxss 先于 wxml（合并 classMap/inlineStyles）。
- **运行时**：`@arkmp/runtime` 职责仅四块——`createPage`/`createComponent` 构造器封装（state → data 桥接 + 生命周期分发）、state 访问器 + Proxy 兜底 + 批量 setData 调度 + 派生字段重算 + `@Watch` 触发、事件参数规范化、`BASE_WXSS` 内置类定义。构建为单文件（`dist/runtime.js`），由编译器注入到产物 `dist/arkmp/runtime.js`。
- **配置加载**：`@arkmp/config` 用 TypeScript 转译 `arkmp.config.ts` 后在沙箱内求值（`require` 仅支持 `@arkmp/cli` / `@arkmp/config` 提供 `defineConfig`），再按 schema 校验并与默认值合并。非法字段报 error 并回落默认值，未知字段报 warning 并忽略。

## 包结构约定

新增包照 `packages/core/shared` 的形态复制：

- `package.json`：`"type": "module"`，`exports` 指向 `dist/index.{mjs,cjs}` + `dist/index.d.{mts,cts}`；内部包标 `"private": true`；workspace 内依赖用 `"workspace:*"`。
- `tsdown.config.ts`：`entry: ['src/index.ts']`，`format: ['esm', 'cjs']`，`dts: true`，`sourcemap: true`，`clean: true`。
- `tsconfig.json`：`extends` 根 `tsconfig.base.json`，`include: ["src", "tests"]`。
- `src/index.ts`：包入口，re-export 公开 API。
- `tests/`：Vitest 单测，每个包可独立 `pnpm test`。
- 三个 script：`build`（tsdown）、`test`（vitest run）、`typecheck`（tsc --noEmit）。

依赖方向严格单向（L0 → L1 → L2 → L3 → L4 → L7），禁止循环。`L5 runtime` 和 `L6 source-side` 是独立子树，不进入编译器依赖链。

## 代码风格

- **语言**：源码注释、日志消息使用简体中文；代码标识符、API 名称、文件路径保持英文原文。
- **注释密度**：每个包的入口 `src/index.ts` 有文件头注释块，说明包职责、管线位置与关键约定（参照已有包的风格）。
- **纯函数优先**：编译管线各阶段为纯函数，无副作用、无 I/O；同一输入产出完全一致。I/O（文件读写、watch）只在 `@arkmp/compiler` 和 `@arkmp/cli` 层处理。
- **诊断不抛异常**：语法错误等不抛异常，收集为 error 诊断返回。有 error 时仍返回部分产物，调用方按 `hasErrors` 判定是否阻断。
- **`@arkmp/ir` 零依赖**：不引用 `typescript`，所有 `ts.Node` 在 analyze 阶段已序列化。
- 运行时报错/告警均带 `[arkmp]` 前缀。

## 测试策略

- **每包 `tests/` 目录**，Vitest 单测；`@arkmp/test-utils` 提供 fixture 加载与产物快照比对。
- **transform 包与 mapping 包**的单测即设计文档 03–06 篇规则清单的可执行形式：每条规则至少一个 fixture，以快照测试为主。
- **`@arkmp/pipeline`** 是无 I/O 纯函数，用 `.ets` 源码 → 四件套快照做端到端锚点测试。
- **`@arkmp/compiler`** 用临时目录构造多文件工程做集成测试（含增量编译、依赖图级联重建）。
- **`@arkmp/types`** 用 tsd 做类型级测试（`tests/` 目录，`tsd.directory` 配置）。
- **`@arkmp/runtime`** 有 `size.test.ts` 断言单文件产物 <10KB。
- **e2e**（顶层 `e2e/`，非 workspace 子包的编译器内部包）：runtime 行为测试（mock `Page()`/`Component()`）、完整 demo 工程 build、CI 可用性验证。

## CLI 命令

```bash
ark-mp init <name> [--template demo]     # 创建新工程（default / demo 模板）
ark-mp build                              # 全量编译，输出标准小程序到 dist/
ark-mp dev                                # watch 编译 + 自动唤起微信开发者工具
ark-mp compile <file> --out <dir>         # 单文件编译（渐进接入已有小程序）
ark-mp check <dir>                        # 只跑诊断，不产出
ark-mp preview                            # 生成预览二维码
ark-mp upload --version 1.0.0             # 上传代码
ark-mp doctor                             # 环境检查（Node 版本、开发者工具 CLI、appId）
```

`@arkmp/cli` 的 `createApp()` 返回 cac 实例（不自动解析 argv），供测试注入参数；`run(argv)` 是 bin 入口。每个命令返回 `CommandResult`（code + diagnostics + message），不直接 `process.exit`。

## 文档编写约定

修改或新增文档时遵循：

- **语言**：全部文档使用简体中文；代码、API 名称、文件路径保持原文。
- **命名**：每个目录一个 `README.md` 作为索引；正文文件按 `NN-kebab-name.md` 两位数字前缀编号排序。
- **索引同步**：新增或重命名文档后，必须同步更新所属目录 `README.md` 中的索引表（表格形式：`文档 | 内容`）。
- **标题**：正文文件一级标题形如 `# 01. 概述`（编号 + 空格 + 点 + 标题）。
- **代码块语言标记**：ArkTS/TypeScript 用 ` ```ts `，小程序 JS 用 ` ```js `，WXML 用 ` ```html `，WXSS 用 ` ```css `，JSON 用 ` ```json `，命令行用 ` ```bash `；架构图、目录树等用 ` ```text ` 包裹的 ASCII 图。
- **代码示例风格**：ArkUI 示例使用装饰器 + `build()` 链式 UI 描述；小程序示例使用原生 WXML/WXSS/JS，不引入第三方框架。
- **版本标注**：涉及版本敏感能力时标注最低版本（如 HarmonyOS NEXT / API 12+、小程序基础库 3.x）。

## 数据来源约定

映射表与白名单的数据以 OpenHarmony 官方实现为准，不凭文档手抄：

- **组件链式 API 清单**（mapping-components）：以 `arkui_ace_engine` 仓的 JSBind 注册为 ground truth。
- **状态管理语义**（runtime、transform-js）：以同仓 `state_mgmt/` 官方 TypeScript 实现为行为基准。
- **默认样式值**（mapping-styles）：以 `ark_theme/` 与 `components_ng/` 主题定义为准。
- **组件 d.ts**（types）：以 `interface_sdk-js` 仓（SDK 声明文件来源）为准。

## Git 状态

仓库已有一次完整提交（`feat: implement ArkMP compiler — ArkUI to WeChat MiniProgram`）。除非用户明确要求，不要执行 `git commit`、`git push`、`git reset` 等 git 变更操作。
