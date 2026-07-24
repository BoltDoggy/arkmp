---
name: spec-first
description: |
  需求澄清与原型确认 skill。当 agent 接到功能开发、界面设计、系统重构等任务时，
  必须先澄清需求、确认原型/方案，获得用户明确认可后再进入编码阶段。
  本 skill 适用于任何涉及新功能、新界面、新流程、架构调整的任务，
  不适用于一行修复、typo、明确的 bug fix 等意图清晰的任务。
---

# spec-first — 需求澄清与原型确认

## 1. 原则声明

> **需求澄清优先（Spec-First Principle）**：在编写任何业务代码之前，agent 必须确保对需求的理解是完整、无歧义、经过用户确认的。模糊的需求是返工的最大根源。

本 skill 要求 agent 在接到任务后，**先提问、再设计、后编码**，通过结构化澄清和原型确认来消除不确定性。

## 2. 适用判断

收到任务后，agent 首先判断是否需要走澄清流程：

| 任务类型 | 是否需要澄清 | 说明 |
|---|---|---|
| 新功能开发 | ✅ 必须 | 需求通常不完整，需逐项确认 |
| 新界面/交互 | ✅ 必须 | 需原型确认布局与流程 |
| 系统重构/架构调整 | ✅ 必须 | 需确认范围、约束、兼容性 |
| 集成第三方服务 | ✅ 必须 | 需确认认证方式、数据格式、异常处理 |
| Bug 修复（意图明确） | ❌ 跳过 | 复现步骤和期望行为已清晰 |
| 配置微调 / typo | ❌ 跳过 | 改动意图明确，无需澄清 |
| 文档更新 | ❌ 跳过 | 内容性任务，不涉及代码逻辑 |

**判断准则**：如果无法用一句话准确描述"做什么、输入是什么、输出是什么、边界在哪"，就需要澄清。

## 3. 澄清流程总览

```
┌─────────────────────────────────────────────────────┐
│  Step 1: 初步理解 — 复述任务，确认大方向               │
│  Step 2: 结构化提问 — 逐维度消除模糊点                 │
│  Step 3: 方案输出 — 用原型/伪代码/数据模型表达理解      │
│  Step 4: 用户确认 — 获得明确认可                        │
│  Step 5: 进入编码 — 基于确认后的方案实施                │
└─────────────────────────────────────────────────────┘
```

## 4. Step 1 — 初步理解

agent 接到任务后的第一件事：**用自己的话复述任务目标**。

- 用 1-3 句话概括"我理解你要做的是……"
- 列出已知信息和缺失信息
- 标注初步识别到的模糊点

**目的**：确保大方向正确，避免在错误的方向上深入。

### 示例

> 你说要做一个"用户导出功能"。我理解的是：在设置页面增加一个按钮，点击后把当前用户的数据导出为 CSV 文件下载。
>
> 需要确认的点：
> 1. 导出范围——是全部数据还是可选择？
> 2. 导出格式——CSV、Excel 还是 JSON？
> 3. 数据量——是否需要异步处理？

## 5. Step 2 — 结构化提问

**提问原则**：

- **一次性批量提问**：不要挤牙膏式逐条问，一次性列出所有需要确认的点。
- **给出默认建议**：每个问题附上 agent 的推荐选项，降低用户决策成本。
- **分层提问**：先问核心约束（必须知道的），再问细节（锦上添花的）。
- **避免开放式空问**：用"是 A 还是 B？"代替"你想要什么？"。

### 澄清维度检查表

根据任务类型，选择相关维度逐项确认：

#### 功能逻辑

- [ ] **核心输入/输出**：用户输入什么？系统返回什么？
- [ ] **边界条件**：空数据？超大数据？非法输入？
- [ ] **异常处理**：失败时重试、降级还是报错？
- [ ] **权限控制**：谁可以操作？需要鉴权吗？
- [ ] **并发/状态**：是否涉及并发？有无状态流转？

#### 界面/交互

- [ ] **布局结构**：页面/组件的大致结构
- [ ] **交互流程**：用户操作步骤是怎样的？
- [ ] **状态展示**：加载中、空状态、错误状态如何展示？
- [ ] **响应式**：需要适配移动端吗？
- [ ] **风格参考**：有参考设计或已有页面风格吗？

#### 数据/接口

- [ ] **数据来源**：数据从哪来？已有接口还是需要新建？
- [ ] **数据格式**：请求/响应的数据结构
- [ ] **存储**：需要持久化吗？存哪里？
- [ ] **缓存**：需要缓存吗？过期策略？
- [ ] **兼容性**：是否需要兼容已有数据/接口？

#### 非功能需求

- [ ] **性能**：有响应时间或吞吐量要求吗？
- [ ] **安全**：有安全合规要求吗？
- [ ] **可观测性**：需要日志、监控、埋点吗？
- [ ] **国际化**：需要多语言支持吗？

## 6. Step 3 — 方案输出（原型确认）

澄清完成后，agent 必须将理解转化为**可视化的方案**，供用户确认。所有产出物存放在项目根目录的 `.specs/` 下。

### 6.0 `.specs/` 目录约定

```
.specs/                          # 需求与原型工作区（不提交到 Git）
└── <requirement-name>/          # 需求目录，kebab-case 命名，如 user-export
    ├── spec.md                  # 需求规格：方案概要、关键决策、影响范围
    ├── prototype.html           # HTML 原型（界面类任务，浏览器直接打开预览）
    ├── prototype-<page>.html    # 多页面时按页面拆分，如 prototype-detail.html
    └── assets/                  # 可选：原型引用的图片等资源
```

**规则**：

- `.specs/` 已在 `.gitignore` 中忽略，**不提交到版本控制**——它是 agent 与用户之间的临时工作区。
- 目录名用 kebab-case，简明表达需求主题（如 `search`、`payment-refactor`、`admin-dashboard`）。
- 每个需求一个子目录，互不干扰；需求确认并进入编码后，可选择保留作为参考或删除。
- **界面类任务必须输出 HTML 原型**，不得仅用文字描述界面。

### 6.1 界面类任务 → HTML 原型

在 `.specs/<requirement-name>/prototype.html` 中编写 **自包含的 HTML 页面**（内联 CSS，无需外部依赖），用浏览器直接打开即可预览。

**HTML 原型要求**：

- **结构真实**：用语义化 HTML 搭建页面骨架，体现导航、内容区、表单、按钮等真实布局
- **样式接近最终效果**：内联 `<style>` 写 CSS，还原间距、颜色、字号等视觉层次
- **占位数据**：填充合理的示例数据，让用户直观感受信息密度
- **交互提示**：用注释标注交互行为，如 `<!-- 点击后弹出导出确认对话框 -->`
- **多状态**：同一页面可用 CSS class 切换空状态、加载状态等（如 `state-empty`、`state-loading`）

**最简模板**：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>原型 - 用户导出</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, "PingFang SC", sans-serif; background: #f5f5f5; color: #333; }
    .navbar { display: flex; align-items: center; justify-content: space-between;
              padding: 12px 24px; background: #fff; border-bottom: 1px solid #e8e8e8; }
    .content { max-width: 960px; margin: 24px auto; padding: 0 24px; }
    .card { background: #fff; border-radius: 8px; padding: 24px; margin-bottom: 16px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    .btn { display: inline-block; padding: 8px 20px; border-radius: 4px; cursor: pointer;
           text-decoration: none; font-size: 14px; border: none; }
    .btn-primary { background: #1890ff; color: #fff; }
    .btn-default { background: #fff; border: 1px solid #d9d9 d9; color: #333; }
    /* 空状态/加载状态可切换 */
    .state-empty { display: none; }
    .state-empty.show { display: block; }
  </style>
</head>
<body>
  <!-- 导航栏 -->
  <nav class="navbar">
    <span>📋 数据中心</span>
    <span>👤 张三</span>
  </nav>

  <!-- 主内容 -->
  <div class="content">
    <div class="card">
      <h2 style="margin-bottom:16px;">用户数据导出</h2>
      <p style="color:#999;margin-bottom:16px;">选择导出范围，点击按钮生成文件下载。</p>

      <!-- 导出选项 -->
      <div style="margin-bottom:16px;">
        <label><input type="radio" name="range" checked> 全部数据</label>
        <label style="margin-left:16px;"><input type="radio" name="range"> 按时间范围</label>
      </div>

      <!-- 点击后弹出确认对话框 -->
      <button class="btn btn-primary" onclick="alert('原型演示：点击后应弹出确认框')">导出 CSV</button>
      <button class="btn btn-default">刷新</button>
    </div>

    <!-- 空状态示例 -->
    <div class="card state-empty">
      <p style="text-align:center;color:#ccc;padding:40px 0;">暂无数据</p>
    </div>
  </div>
</body>
</html>
```

对于多页面应用，每个页面一个 HTML 文件（如 `prototype-list.html`、`prototype-detail.html`），用 `<a>` 标签互相链接。

### 6.2 数据/接口类任务 → 数据模型 + 接口定义

数据模型和接口定义写入 `.specs/<requirement-name>/spec.md`，用代码块表达：

```typescript
// 数据模型
interface ExportTask {
  id: string;
  userId: string;
  status: 'pending' | 'processing' | 'done' | 'failed';
  format: 'csv' | 'excel';
  createdAt: string;
  downloadUrl?: string;
}

// 接口定义
POST /api/exports
  Request:  { format: 'csv' | 'excel', dateRange?: [string, string] }
  Response: { taskId: string }
  Error:    401 未登录 / 429 频率限制
```

### 6.3 流程/逻辑类任务 → 流程图/状态机

流程描述写入 `.specs/<requirement-name>/spec.md`：

```
用户点击导出
    │
    ▼
创建导出任务 (status: pending)
    │
    ▼
异步处理 (status: processing) ──失败──→ status: failed → 通知用户重试
    │
    ▼
生成文件 (status: done)
    │
    ▼
通知用户下载
```

### 6.4 `spec.md` 模板

每次启动澄清时，在 `.specs/<requirement-name>/spec.md` 中创建规格文件：

```markdown
# <需求名称>

## 方案概要

**目标**：一句话描述
**方案**：核心设计思路

## 关键决策
| 决策点 | 选择 | 理由 |
|---|---|---|
| 导出格式 | 默认 CSV | 兼容性最好，满足大多数场景 |
| 处理方式 | 异步 | 预计数据量大，避免请求超时 |

## 数据模型 / 接口
（如有，粘贴代码块）

## 流程 / 状态机
（如有，粘贴流程图）

## 影响范围
- 新增文件：...
- 修改文件：...
- 新增依赖：...

## 原型文件
- `prototype.html` — 主页面原型

## 待确认
- [ ] 还有需要调整的地方吗？
```

## 7. Step 4 — 用户确认

方案输出后，**必须等待用户明确确认**再进入编码。确认方式：

- 用户回复"可以"/"没问题"/"开始吧"等肯定语 → 进入编码
- 用户提出修改 → 更新方案后再次确认
- 用户沉默或含糊 → 主动追问："这个方案可以开始实施吗？"

**禁止行为**：
- ❌ 假设用户默认同意，自行开始编码
- ❌ 在同一轮回复中既输出方案又开始写代码
- ❌ 把"我理解你要做 X"当作已确认

## 8. Step 5 — 进入编码

获得确认后，进入编码阶段。编码时应：

1. 严格按照确认的方案实施
2. 如发现方案遗漏或不可行，**暂停编码**，回到澄清流程
3. 实现过程中如有新的设计决策，记录并同步用户

## 9. 常见场景示范

### 场景 A：用户说"加个搜索功能"

❌ **错误做法**：直接开始写搜索框 + 搜索接口。

✅ **正确做法**：

> 我理解你要加一个搜索功能。在开始之前，需要确认几个点：
>
> 1. **搜索范围**：搜全部数据还是指定字段？（建议：标题 + 内容）
> 2. **搜索方式**：精确匹配还是模糊搜索？（建议：模糊搜索，支持中文分词）
> 3. **结果展示**：列表页展示还是下拉联想？（建议：先做列表页搜索）
> 4. **性能**：数据量大概多少？（影响是否需要搜索引擎如 ES）

### 场景 B：用户说"重构这个模块"

❌ **错误做法**：读完代码直接开始重构。

✅ **正确做法**：

> 我看了 `payment` 模块的代码，计划做以下重构。先确认几点：
>
> 1. **重构目标**：主要解决可维护性、性能还是功能扩展？（建议：可维护性优先）
> 2. **兼容性**：对外接口保持不变还是允许调整？（建议：保持不变，内部重构）
> 3. **节奏**：一次性重构还是分步迁移？（建议：分步，先抽离核心逻辑）
>
> 重构方案草图：
> ```
> 现状：PaymentService（God class，500+ 行）
>   ↓
> 目标：
>   PaymentValidator  — 参数校验
>   PaymentProcessor — 核心处理
>   PaymentNotifier  — 通知
> ```
>
> 这个方向可以吗？

### 场景 C：用户说"做个管理后台"

❌ **错误做法**：开始搭建项目框架。

✅ **正确做法**：

> 管理后台范围比较大，我们先对齐核心信息：
>
> 1. **管理什么**：用户？订单？内容？还是全部？
> 2. **使用者**：技术运营？业务人员？（影响交互复杂度）
> 3. **技术栈**：有指定框架吗？（建议：React + Ant Design Pro）
> 4. **认证**：用已有登录系统还是独立账号？
>
> 建议先从最核心的模块开始（比如用户管理），确认后再逐步扩展。你看先做哪个模块？

## 10. 与 doc-first 配合

本 skill 与 `doc-first` 配合使用。两者产出物的定位不同：

| | `.specs/`（spec-first） | `docs/`（doc-first） |
|---|---|---|
| **阶段** | 澄清中，方案未定稿 | 已确认，正式归档 |
| **内容** | 草稿、待确认项、HTML 原型 | 架构文档、ADR、API 契约、用户指南 |
| **版本控制** | ❌ 不提交（临时工作区） | ✅ 提交（项目交付物） |

### 完整流程

```
需求输入
  │
  ▼
[spec-first] 在 .specs/<name>/ 下澄清需求、输出原型
  │           （spec.md 草稿 + prototype.html，不提交）
  │
  ▼  ← 用户确认方案
  │
[doc-first] 将确认的方案沉淀到 docs/ 正式文档
  │           spec.md 中的关键决策 → docs/adr/ 或 docs/architecture/
  │           数据模型/接口       → docs/api/
  │           用户侧说明           → docs/guide/
  │           （提交到 Git）
  │
  ▼
编码实现 → 更新文档
```

### 确认后的迁移动作

用户确认方案后，不要直接开始编码——先将 `.specs/<name>/spec.md` 中的内容迁移到 `docs/` 对应位置：

| spec.md 中的内容 | 迁移目标 |
|---|---|
| 关键决策及理由 | `docs/adr/NNN-title.md`（如涉及架构决策） |
| 功能定位与模块职责 | `docs/architecture/overview.md` |
| 数据模型与接口契约 | `docs/api/` |
| 用户侧使用说明 | `docs/guide/` 或 `docs/COMMANDS.md` |

迁移完成后，`.specs/<name>/` 可保留作参考或删除，不影响项目。

## 11. 检查清单

进入编码前，确认：

- [ ] 已复述任务目标并获得用户认可大方向
- [ ] 已针对相关维度提出澄清问题
- [ ] 用户已回答所有关键问题
- [ ] 已在 `.specs/<requirement-name>/` 下输出可视化方案（HTML 原型 / 数据模型 / 流程图）
- [ ] 方案中的关键决策有标注理由
- [ ] 已说明影响范围（新增/修改的文件）
- [ ] 用户已明确表示"可以开始"
