# AGENTS.md

本文件面向 AI 编码代理，介绍本仓库的结构与约定。阅读本文件前无需了解任何背景。

## 项目概述

`ark-mini` 包含三组相互关联的中文技术文档（主题是"用 ArkUI 语法开发微信小程序"）与一个正在搭建中的 ArkMP 编译器 pnpm monorepo 实现（`packages/`）：

- **HarmonyOS ArkUI 参考文档**（`docs/arkui/`）：ArkUI 框架（ArkTS 声明式 UI）的学习与参考材料。
- **微信小程序参考文档**（`docs/miniprogram/`）：微信原生小程序（WXML / WXSS / JavaScript）的学习与参考材料。
- **ArkMP 设计文档**（`docs/arkui-miniprogram/`）：一个名为 **ArkMP** 的编译工具的完整设计方案。ArkMP 类似 Taro，但输入是 ArkUI / ArkTS 声明式语法（`@Entry`、`@Component`、`@State`、`build()` 链式 UI 描述），**只输出微信小程序**工程（WXML / WXSS / JS / JSON + `@arkmp/runtime` 轻量运行时）。ArkMP 的实现代码在 `packages/`（pnpm monorepo，正在按 `09-monorepo.md` 逐层补齐）。

三组文档的关系：`docs/arkui/` 描述编译器的输入端，`docs/miniprogram/` 描述输出端，`docs/arkui-miniprogram/` 描述从输入到输出的转换设计。

## 目录结构

```
docs/
├── arkui/                 # ArkUI 参考文档（9 篇 + README 索引）
│   ├── 01-overview.md         概述、架构、声明式范式
│   ├── 02-declarative-ui.md   @Entry/@Component、build()、生命周期
│   ├── 03-state-management.md @State/@Prop/@Link/@Provide/@Consume 等
│   ├── 04-common-components.md 基础组件
│   ├── 05-layout.md           布局容器
│   ├── 06-navigation.md       路由与导航
│   ├── 07-animation.md        动画
│   ├── 08-gestures.md         手势
│   └── 09-resources.md        资源与样式复用
├── miniprogram/           # 微信小程序参考文档（9 篇 + README 索引）
│   ├── 01-overview.md … 09-optimization.md
└── arkui-miniprogram/     # ArkMP 编译工具设计文档（9 篇 + README 索引）
    ├── 01-overview.md         总体设计、编译管线总览
    ├── 02-pipeline.md         编译流程详设
    ├── 03-component-mapping.md 组件转换规则
    ├── 04-style-mapping.md    样式转换规则
    ├── 05-state-lifecycle-mapping.md 状态与生命周期转换
    ├── 06-api-mapping.md      运行时与 API 适配层
    ├── 07-cli.md              工程与 CLI 设计
    ├── 08-limitations.md      语法子集与限制
    └── 09-monorepo.md         monorepo 工程分层（packages/ 的依据）

packages/                  # ArkMP 编译器实现（pnpm workspace，按 09 篇分层）
├── core/                  # L0 基础层：shared / diagnostics / ir
├── source-side/           # L6 源码侧支撑：types / api / eslint-plugin（均对外发布）
└── testing/               # 测试基建：test-utils
```

## 构建、测试与运行

`packages/` 为 pnpm monorepo（全部 TypeScript，构建用 tsdown 产出 ESM+CJS+d.ts，测试用 Vitest）：

- `pnpm install`：安装依赖
- `pnpm build` / `pnpm test` / `pnpm typecheck`：根 scripts，内部用 `pnpm -r` 按拓扑序跑全部包
- 新增包照 `packages/core/shared` 的形态复制：`package.json`（exports 指向 `dist/index.{mjs,cjs}` + `dist/index.d.{mts,cts}`，内部包 `"private": true`）、`tsdown.config.ts`、`tsconfig.json`（extends 根 `tsconfig.base.json`）、`src/index.ts`、`tests/`；workspace 内依赖用 `workspace:*`
- 文档中出现的代码示例（`.ets`、`wxml`、`js` 等）仍为说明性示例；实现代码放在 `packages/` 下，以 `docs/arkui-miniprogram/` 设计文档为准

## 文档编写约定

修改或新增文档时遵循以下既有约定：

- **语言**：全部文档使用简体中文；代码、API 名称、文件路径保持原文。
- **命名**：每个目录一个 `README.md` 作为索引；正文文件按 `NN-kebab-name.md` 两位数字前缀编号排序。
- **索引同步**：新增或重命名文档后，必须同步更新所属目录 `README.md` 中的索引表（表格形式：`文档 | 内容`）。
- **标题**：正文文件一级标题形如 `# 01. 概述`（编号 + 空格 + 点 + 标题）。
- **代码块**：始终标注语言标记——ArkTS/TypeScript 用 ` ```ts `，小程序 JS 用 ` ```js `，WXML 用 ` ```html `，WXSS 用 ` ```css `，JSON 用 ` ```json `，命令行用 ` ```bash `；架构图、目录树等用 ` ```text ` 包裹的 ASCII 图（仓库中大量出现）。
- **代码示例风格**：ArkUI 示例使用装饰器 + `build()` 链式 UI 描述；小程序示例使用原生 WXML/WXSS/JS，不引入第三方框架。
- **版本标注**：涉及版本敏感能力时标注最低版本（如 HarmonyOS NEXT / API 12+、小程序基础库 3.x）。

## Git 状态说明

仓库目前**尚无提交记录**：`docs/arkui/` 与 `docs/miniprogram/` 已加入暂存区（staged），`docs/arkui-miniprogram/` 尚未跟踪。除非用户明确要求，不要执行 `git commit` 等变更操作。
