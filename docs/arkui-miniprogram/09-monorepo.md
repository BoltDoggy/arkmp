# 09. monorepo 工程分层

本篇描述 ArkMP 编译器实现的代码组织：pnpm monorepo、按编译管线分层的 package 划分、依赖规则与测试策略。划分原则：**每个 package 原子化、可独立单元测试**；纯数据（映射表/白名单）独立成包，使 03–06 篇的每条转换规则都能对应到具体包的 fixture 用例。

## 分层总览

以 02 篇的六阶段管线为骨架，分八层，依赖严格单向（只允许上层依赖下层，禁止循环）：

```text
L0 core        基础层：shared / diagnostics / ir（无业务语义）
L1 frontend    源码 → IR：parser / analyzer
L2 transforms  IR → 产物片段：四条转换链 + 映射数据包（链与链互不依赖）
L3 backend     产物拼装：emitter
L4 compiler    编译内核：pipeline / dep-graph / incremental / watcher / compiler
L5 runtime     产物运行时（独立子树，不进入编译器依赖链）
L6 source-side 源码侧支撑：types / api / eslint-plugin（独立子树）
L7 cli         命令行：config / templates / devtool / cli
```

## 构建与发布约定

- **包管理**：pnpm workspace，目录按层分组 `packages/<层>/<包>`。
- **构建**：各包用 tsdown 产出 ESM/CJS 双格式 + d.ts；测试用 Vitest（转换包以快照测试为主）。
- **发布范围**：只对外发布 6 个包——`@arkmp/cli`、`@arkmp/compiler`、`@arkmp/runtime`、`@arkmp/types`、`@arkmp/api`、`@arkmp/eslint-plugin`（即 07 篇"npm 包规划"中的包）。其余内部包一律 `"private": true`，拆分与合并不受 semver 约束。

## 目录结构

```text
packages/
├── core/                    # L0 基础层
│   ├── shared/              #   @arkmp/shared（private）
│   ├── diagnostics/         #   @arkmp/diagnostics（private）
│   └── ir/                  #   @arkmp/ir（private）
├── frontend/                # L1 源码 → IR
│   ├── parser/              #   @arkmp/parser（private）
│   └── analyzer/            #   @arkmp/analyzer（private）
├── transforms/              # L2 四条转换链 + 数据包
│   ├── mapping-components/  #   @arkmp/mapping-components（private，纯数据）
│   ├── mapping-styles/      #   @arkmp/mapping-styles（private，纯数据）
│   ├── transform-wxml/      #   @arkmp/transform-wxml（private）
│   ├── transform-wxss/      #   @arkmp/transform-wxss（private）
│   ├── transform-js/        #   @arkmp/transform-js（private）
│   ├── transform-events/    #   @arkmp/transform-events（private）
│   └── transform-json/      #   @arkmp/transform-json（private）
├── backend/
│   └── emitter/             #   @arkmp/emitter（private）
├── compiler/                # L4 编译内核
│   ├── pipeline/            #   @arkmp/pipeline（private）
│   ├── dep-graph/           #   @arkmp/dep-graph（private）
│   ├── incremental/         #   @arkmp/incremental（private）
│   ├── watcher/             #   @arkmp/watcher（private）
│   └── compiler/            #   @arkmp/compiler（对外）
├── runtime/
│   └── runtime/             #   @arkmp/runtime（对外，单文件产物）
├── source-side/             # L6 源码侧支撑
│   ├── types/               #   @arkmp/types（对外）
│   ├── api/                 #   @arkmp/api（对外）
│   └── eslint-plugin/       #   @arkmp/eslint-plugin（对外）
├── cli/                     # L7 命令行
│   ├── config/              #   @arkmp/config（private）
│   ├── templates/           #   @arkmp/templates（private）
│   ├── devtool/             #   @arkmp/devtool（private）
│   └── cli/                 #   @arkmp/cli（对外，bin: ark-mp）
└── testing/
    └── test-utils/          #   @arkmp/test-utils（private）
```

## 各包职责

### L0 core

| 包 | 职责 | 单测重点 |
| --- | --- | --- |
| `@arkmp/shared` | 纯函数工具：内容哈希、路径规范化、logger 接口 | 表驱动纯函数测试 |
| `@arkmp/diagnostics` | 结构化诊断模型与格式化（02 篇诊断格式） | 格式化输出快照 |
| `@arkmp/ir` | IR 类型 + 节点 id 分配 + 序列化/校验；零依赖，不引用 `ts.*` | id 稳定性、校验正反例 |

### L1 frontend

| 包 | 职责 | 单测重点 |
| --- | --- | --- |
| `@arkmp/parser` | `struct`→`class` 预处理（含位置映射）+ TS AST 解析 | 行列号可回溯原文件 |
| `@arkmp/analyzer` | AST → ComponentModel：装饰器白名单、控制流归一、表达式分类 | 每种语法点一个 fixture |

### L2 transforms

| 包 | 职责 | 单测重点 |
| --- | --- | --- |
| `@arkmp/mapping-components` | 组件映射表（纯数据，03 篇的机器可读形式） | 表完整性：无重复键、必需字段齐全 |
| `@arkmp/mapping-styles` | 样式白名单 + vp→rpx 换算（04 篇） | 白名单校验、换算边界值 |
| `@arkmp/transform-wxml` | buildTree → WXML：组件映射、`wx:if`/`wx:for`、`{{}}` 绑定 | 03 篇每条规则一个快照 fixture |
| `@arkmp/transform-wxss` | styleCalls → WXSS 类 + 内联兜底 | 类名稳定性、降级诊断 |
| `@arkmp/transform-js` | states/props/lifecycle → data/properties/桥接（05 篇） | 各装饰器桥接产物 |
| `@arkmp/transform-events` | eventCalls → 事件表 + 回调方法抽取 | 事件名由节点 id 派生 |
| `@arkmp/transform-json` | 装饰器参数 → 页面/组件 json | 配置字段映射 |

### L3 backend / L4 compiler

| 包 | 职责 | 单测重点 |
| --- | --- | --- |
| `@arkmp/emitter` | 四件套拼装：缩进、头注释、sourcemap | 产物可读性快照 |
| `@arkmp/pipeline` | 单文件编译编排，纯函数 `compile(source, options) → OutputFile[]` | 端到端 fixture 快照 |
| `@arkmp/dep-graph` | 组件依赖图 | 级联重建集合 |
| `@arkmp/incremental` | 哈希缓存 + 变更判定 | 命中/失效 |
| `@arkmp/watcher` | chokidar 封装，事件 → 增量调度 | 事件序列 → 重建调用 |
| `@arkmp/compiler` | **对外**。工程级编译入口 | 多文件工程集成测试 |

### L5 runtime / L6 source-side / L7 cli

| 包 | 职责 |
| --- | --- |
| `@arkmp/runtime` | **对外**。状态桥接、Proxy 兜底、工具函数；包内模块各自单测，构建为单文件（<10KB 预算测试） |
| `@arkmp/types` | **对外**。`.ets` 的 d.ts（tsd 类型测试） |
| `@arkmp/api` | **对外**。源码侧 API 命名空间 + wx.* 映射表（06 篇） |
| `@arkmp/eslint-plugin` | **对外**。编码期越界语法检查（08 篇） |
| `@arkmp/config` | `arkmp.config.ts` 加载 + `defineConfig` + schema 校验 |
| `@arkmp/templates` | init 脚手架模板（纯模板 + 渲染函数） |
| `@arkmp/devtool` | 开发者工具唤起 + miniprogram-ci 封装 |
| `@arkmp/cli` | **对外**，`bin: ark-mp`。init/dev/build/compile/preview/upload/doctor/check |

## 依赖规则

```text
   L0 shared / diagnostics / ir
     ▲          ▲          ▲
   L1 parser   analyzer ───┘
     └──────┬───┘
   L2 mapping-components / mapping-styles（纯数据）
     ▲
   transform-wxml / -wxss / -js / -events / -json（互不依赖）
     └──────┬───┘
   L3 emitter ──▶ L4 pipeline ──▶ dep-graph / incremental ──▶ watcher ──▶ compiler
                                                                          ▲
   L7 config / templates / devtool ──▶ cli ────────────────────────────────┘

   L5 runtime、L6 types/api/eslint-plugin：独立子树
```

硬性约束：

- IR 包不引用 `ts.*`，所有表达式在 analyze 阶段已序列化为目标无关描述（02 篇③）。
- L2 各 transform 包互不依赖；新增转换链 = 新增包，不改兄弟包。
- 依赖方向违规视为构建错误（可在 CI 用 dependency-cruiser 校验）。

## 数据来源约定

映射表与白名单的数据以 OpenHarmony 官方实现为准，不凭文档手抄：

- **组件链式 API 清单**（mapping-components）：以 `arkui_ace_engine` 仓 `frameworks/bridge/declarative_frontend/jsview/` 的 JSBind 注册为 ground truth（Apache-2.0，引用处保留版权说明）。
- **状态管理语义**（runtime、transform-js）：以同仓 `frameworks/bridge/declarative_frontend/state_mgmt/`（官方 TypeScript 实现）为行为基准，其测试用例可改造为 runtime 行为测试。
- **默认样式值**（mapping-styles）：以 `ark_theme/` 与 `components_ng/` 主题定义为准。
- **组件 d.ts**（types）：以 `interface_sdk-js` 仓（SDK 声明文件来源）为准，不在 ace_engine 仓。

## 测试策略

- 每包 `tests/` 目录，Vitest 单测；`@arkmp/test-utils` 提供 fixture 加载与产物快照比对。
- transform 包与 mapping 包的单测即 03–06 篇规则清单的可执行形式：每条规则至少一个 fixture。
- `@arkmp/pipeline` 是无 I/O 纯函数，作为整个编译器单测的锚点（`.ets` 源码 → 四件套快照）。
- e2e（顶层 `e2e/`，非 package）：miniprogram-simulate 跑产物行为测试，完整 demo 工程 build 快照。

## 实现顺序

全部功能点已拆为原子任务清单（Phase 0 脚手架 → Phase 8 e2e，共 53 项），按依赖顺序逐项实现；详见实现时的任务清单，每完成一个 Phase 做一次 `pnpm -r build && pnpm -r test` 全量验证。
