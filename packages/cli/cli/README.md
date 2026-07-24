# @arkmp/cli

> 对外发布包

ArkMP 命令行入口（`bin: ark-mp`），解析命令参数并编排各内部包完成 07 篇定义的全部命令。

## 所属层

L7 cli（命令行层）

## 依赖

| 依赖 | 用途 |
| --- | --- |
| `@arkmp/compiler` | `buildProject` / `createWatchSession`（build / dev 命令） |
| `@arkmp/config` | `loadConfig`（加载 arkmp.config.ts） |
| `@arkmp/devtool` | `openDevtool` / `preview` / `upload` / `resolveDevtoolCli` |
| `@arkmp/pipeline` | `compile`（compile 单文件命令、check 诊断命令） |
| `@arkmp/templates` | `renderTemplate`（init 脚手架命令） |
| `@arkmp/runtime` | 单文件产物定位（compile 命令拷贝 runtime） |
| `@arkmp/diagnostics` | 诊断格式化输出 |
| `@arkmp/shared` | `normalizePath` |

## 导出 API

### `createApp(exitRef?: { code: number }): CAC`

创建 cac 实例并注册全部命令。传入 `exitRef` 对象可捕获 exit code（`run` 内部使用）。返回 cac 实例，不自动解析 argv。

### `run(argv: string[]): Promise<number>`

bin 入口：解析 argv → 执行命令 → 返回 exit code（不直接 `process.exit`，便于测试）。

### `printDiagnostics(diagnostics: Diagnostic[]): void`

将诊断数组逐条格式化输出到 stderr。

### `CLI_DIAGNOSTIC_CODES`

| 码 | 含义 |
| --- | --- |
| `E8001` | 源文件不存在 |
| `E8002` | runtime 单文件产物定位失败 |

## 命令清单

| 命令 | 说明 |
| --- | --- |
| `ark-mp init <name> [--template demo]` | 创建新工程 |
| `ark-mp build` | 全量构建产物 |
| `ark-mp dev` | watch 编译 + 唤起开发者工具 |
| `ark-mp compile <file> --out <dir>` | 单文件编译（渐进接入） |
| `ark-mp check <dir>` | 只跑编译期诊断，不产出 |
| `ark-mp preview [--appid] [--desc]` | 生成预览二维码 |
| `ark-mp upload --version <ver> [--appid] [--desc]` | 上传代码 |
| `ark-mp doctor` | 检查环境（Node 版本、开发者工具、appId） |

## 用法示例

```bash
# 创建工程
ark-mp init my-app

# 开发
cd my-app && ark-mp dev

# 构建
ark-mp build

# 单文件编译
ark-mp compile src/components/UserCard.ets --out ../existing-mp/components/
```

## 测试

```bash
pnpm --filter @arkmp/cli test
```
