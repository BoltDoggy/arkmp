> 对外发布包

# @arkmp/compiler

工程级编译入口：组合 L4 各内核包，将 ArkUI 源码工程编译为标准微信小程序工程（扫描 → 单文件编译 → usingComponents 解析 → runtime 注入 → app.json 合成 → 增量/watch）。

## 所属层

L4 compiler（编译内核）

## 依赖

| 依赖 | 原因 |
| --- | --- |
| `@arkmp/pipeline` | 单文件编译（`.ets` → 四件套） |
| `@arkmp/incremental` | 哈希缓存 + 级联失效 |
| `@arkmp/dep-graph` | 依赖图（级联重建集合来源） |
| `@arkmp/watcher` | watch 模式事件监听 |
| `@arkmp/mapping-components` | 自定义组件名解析 |
| `@arkmp/runtime` | 运行时单文件注入（`dist/arkmp/runtime.js`） |
| `@arkmp/ir` | ComponentModel 类型定义 |
| `@arkmp/diagnostics` | 诊断模型 |
| `@arkmp/shared` | logger、路径规范化等工具函数 |

## 导出 API

### `compileProject(options: CompileProjectOptions): Promise<BuildResult>`

一次性编译工程：扫描 `src/` 全量编译，写入 `dist/`（不清空产物目录，便于渐进接入）。

### `buildProject(options: CompileProjectOptions): Promise<BuildResult>`

产物构建：清空产物目录后全量编译（对齐 `ark-mp build` 语义）。

### `createWatchSession(options: WatchSessionOptions): CompilerWatchSession`

创建 watch 会话：watcher 事件（`add`/`change`/`unlink` → 去抖合并）→ 增量 build。增量构建串行执行（构建期间到达的变更批次排队，不并发写产物目录）。

### `class CompilerSession`

工程级编译会话。组合 pipeline（单文件编译）、incremental（哈希缓存）与 dep-graph（级联重建）。

- `constructor(options: CompileProjectOptions)`
- `build(changedFiles?: readonly string[]): Promise<BuildResult>` — `changedFiles` 缺省为全量；传入时为增量（src 相对 posix 路径，已删除文件也算变更——其产物会被清理，引用方级联重建）。

### `interface CompileProjectOptions`

工程级编译配置（普通对象，字段对齐 `arkmp.config.ts`）：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `rootDir` | `string` | 工程根目录（含 `src/`） |
| `srcDir?` | `string` | 源码目录（相对 rootDir），默认 `src` |
| `outDir?` | `string` | 产物目录（相对 rootDir），默认 `dist` |
| `appId?` | `string` | 小程序 appId（存在时生成 `project.config.json`） |
| `appName?` | `string` | 应用名（`project.config.json` 的 projectname） |
| `window?` | `Record<string, unknown>` | 全局窗口配置 → `app.json.window` |
| `tabBar?` | `TabBarOptions` | tabBar 配置（pages 按页面 struct 名引用） → `app.json.tabBar` |
| `permission?` | `Record<string, unknown>` | 权限声明 → `app.json.permission` |
| `compile?` | `Pick<CompileOptions, 'unitRatio' \| 'classPrefix' \| 'sourcemap'>` | 透传 pipeline 的单文件编译选项 |
| `logger?` | `Logger` | 日志（默认 console logger） |

### `interface BuildResult`

一次构建的结果：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `files` | `number` | 写入产物文件数量 |
| `diagnostics` | `Diagnostic[]` | 全量诊断（各文件编译诊断 + 工程级诊断汇总） |
| `hasErrors` | `boolean` | 是否存在 error 级诊断 |
| `rebuilt` | `string[]` | 本次实际重编译的 `.ets`（src 相对 posix 路径，排序） |
| `written` | `string[]` | 本次写入的产物（outDir 相对 posix 路径，排序） |

### `interface WatchSessionOptions`

`CompileProjectOptions` 的扩展，增加 watch 配置：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `watch?` | `{ debounceMs?: number; ignore?: ...; source?: WatchEventSource }` | 去抖窗口、忽略规则、测试用事件源注入 |

### `interface CompilerWatchSession`

watch 会话句柄：

- `build(changedFiles?: string[]): Promise<BuildResult>` — 手动触发构建：无参全量；传入 changedFiles 为增量。
- `start(onBuilt?: (result: BuildResult) => void): Promise<BuildResult>` — 首次全量构建 + 开始监听；每次增量构建完成回调 `onBuilt`。
- `close(): Promise<void>` — 停止监听。

### `interface TabBarOptions`

```ts
interface TabBarOptions {
  pages: Array<{ name: string; text: string; icon?: string }>;
  [key: string]: unknown;
}
```

tabBar 配置，`pages` 按页面 struct 名引用。

### `COMPILER_DIAGNOSTIC_CODES`

compiler 包诊断码常量表：

| 码 | 含义 |
| --- | --- |
| `TABBAR_PAGE_NOT_FOUND` (`'W6001'`) | tabBar.pages 引用的页面名未匹配到任何 @Entry 页面 |
| `COMPONENT_PROVIDER_NOT_FOUND` (`'W6002'`) | 自定义组件未找到提供方文件 |
| `RUNTIME_NOT_FOUND` (`'E6001'`) | @arkmp/runtime 单文件产物缺失（需先构建 runtime 包） |
| `SKIPPED_SOURCE` (`'W6003'`) | src/ 下不属于 app/pages/components 的 .ets，已跳过 |

## 用法示例

```ts
import { compileProject, buildProject, createWatchSession } from '@arkmp/compiler';

// 一次性编译（不清空 dist/）
await compileProject({
  rootDir: '/path/to/project',
  appId: 'wx1234567890abcdef',
  window: { navigationBarTitleText: 'My App' },
});

// 全量构建（清空 dist/ 后编译，对齐 ark-mp build）
await buildProject({ rootDir: '/path/to/project' });

// watch 模式
const session = createWatchSession({
  rootDir: '/path/to/project',
  watch: { debounceMs: 50, ignore: /node_modules/ },
});
await session.start((result) => {
  console.log('增量构建完成', result.rebuilt);
});
// 停止监听
// await session.close();
```

## 测试

```bash
pnpm --filter @arkmp/compiler test
```
