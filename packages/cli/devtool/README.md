# @arkmp/devtool

微信开发者工具的命令行封装：唤起开发者工具打开产物目录，以及通过 miniprogram-ci 生成预览二维码与上传代码。

## 所属层

L7 命令行层（cli），为 `@arkmp/cli` 的 `dev`（自动打开开发者工具）、`preview`、`upload` 命令提供底层能力。

## 依赖

- `@arkmp/diagnostics`（`workspace:*`）—— 开发者工具未找到、miniprogram-ci 未安装或调用失败时使用结构化诊断模型返回 error。
- `miniprogram-ci`（可选，非 workspace 依赖）—— `preview`/`upload` 按需 `require`；未安装时不崩溃，返回带安装指引的诊断。

## 导出 API

### `DEVTOOL_DIAGNOSTIC_CODES`

```ts
const DEVTOOL_DIAGNOSTIC_CODES: {
  DEVTOOL_NOT_FOUND: 'E7101';      // 开发者工具 CLI 不存在
  MINIPROGRAM_CI_MISSING: 'E7102'; // miniprogram-ci 未安装
  CI_FAILED: 'E7103';              // miniprogram-ci 调用失败
};
```

devtool 包的诊断码常量。

### `DEFAULT_DEVTOOL_PATH`

```ts
const DEFAULT_DEVTOOL_PATH = '/Applications/wechatwebdevtools.app';
```

macOS 微信开发者工具默认安装路径。

### `ActionResult`

```ts
interface ActionResult {
  ok: boolean;             // 是否成功
  diagnostics: Diagnostic[]; // 诊断为空数组表示成功
}
```

命令执行结果。`preview`/`upload`/`openDevtool` 均返回此类型。

### `devtoolCliPath(devtoolPath?: string): string`

由 app 安装路径推导 CLI 路径（macOS 包内结构 `<devtoolPath>/Contents/MacOS/cli`）。`devtoolPath` 缺省为 `DEFAULT_DEVTOOL_PATH`。

### `ResolveDevtoolDeps`

```ts
interface ResolveDevtoolDeps {
  exists?: (path: string) => boolean; // 存在性检查（测试注入），缺省 existsSync
}
```

`resolveDevtoolCli` 的依赖注入参数。

### `resolveDevtoolCli(devtoolPath?: string, deps?: ResolveDevtoolDeps): { cli?: string; diagnostic?: Diagnostic }`

定位开发者工具 CLI：存在返回 `{ cli }`，不存在返回 `{ diagnostic }`（error 诊断，help 提示安装或配置 `devServer.devtoolPath`）。

### `SpawnFn`

```ts
type SpawnFn = (
  command: string,
  args: readonly string[],
  options: { detached: boolean; stdio: 'ignore' },
) => { unref(): void };
```

spawn 函数形态（与 `node:child_process.spawn` 对齐），用于测试注入。

### `OpenDevtoolOptions`

```ts
interface OpenDevtoolOptions {
  devtoolPath?: string; // 开发者工具安装路径，缺省 DEFAULT_DEVTOOL_PATH
}
```

### `OpenDevtoolDeps`

```ts
interface OpenDevtoolDeps extends ResolveDevtoolDeps {
  spawn?: SpawnFn; // spawn 注入（测试用）
}
```

### `openDevtool(projectPath: string, options?: OpenDevtoolOptions, deps?: OpenDevtoolDeps): ActionResult`

唤起微信开发者工具并打开 `projectPath`（产物目录 `dist/`）。以 detached 模式 spawn `cli open --project <projectPath>`，不阻塞 CLI 进程。CLI 不存在时返回 error 诊断，不抛异常。

### `MiniprogramCi`

```ts
interface MiniprogramCi {
  Project: new (options: Record<string, unknown>) => unknown;
  preview(options: Record<string, unknown>): Promise<unknown>;
  upload(options: Record<string, unknown>): Promise<unknown>;
}
```

miniprogram-ci 的结构化类型（只声明用到的面）。

### `CiBaseOptions`

```ts
interface CiBaseOptions {
  projectPath: string;     // 小程序产物目录（dist/）
  appId: string;           // 小程序 appId
  privateKeyPath?: string; // 代码上传密钥文件路径
}
```

### `PreviewOptions`

```ts
interface PreviewOptions extends CiBaseOptions {
  desc?: string;        // 预览版本描述
  qrcodeOutput?: string; // 'terminal' 直接在终端打印；否则为图片输出路径
}
```

### `UploadOptions`

```ts
interface UploadOptions extends CiBaseOptions {
  version: string;    // 版本号（必填）
  desc?: string;      // 版本描述
  robot?: number;     // 机器人编号（1–30），缺省 1
}
```

### `CiDeps`

```ts
interface CiDeps {
  ci?: MiniprogramCi; // 注入 miniprogram-ci 模块（测试用）
}
```

### `preview(options: PreviewOptions, deps?: CiDeps): Promise<ActionResult>`

生成预览二维码（封装 `miniprogram-ci` 的 `preview`）。miniprogram-ci 未安装时返回带安装指引的 error 诊断；调用失败时返回 `CI_FAILED` 诊断。

### `upload(options: UploadOptions, deps?: CiDeps): Promise<ActionResult>`

上传代码（封装 `miniprogram-ci` 的 `upload`）。miniprogram-ci 未安装时返回带安装指引的 error 诊断；调用失败时返回 `CI_FAILED` 诊断。

## 用法示例

```ts
import { openDevtool, preview, upload } from '@arkmp/devtool';

// dev 模式：打开开发者工具
const result = openDevtool('/path/to/dist', {
  devtoolPath: '/Applications/wechatwebdevtools.app',
});
if (!result.ok) {
  console.error(result.diagnostics);
}

// 生成预览二维码
const previewResult = await preview({
  projectPath: './dist',
  appId: 'wx1234567890abcdef',
  privateKeyPath: './private.wx1234567890abcdef.key',
  qrcodeOutput: 'terminal',
});

// 上传代码
const uploadResult = await upload({
  projectPath: './dist',
  appId: 'wx1234567890abcdef',
  privateKeyPath: './private.wx1234567890abcdef.key',
  version: '1.0.0',
  desc: '首次上传',
});
```

## 测试

```bash
pnpm --filter @arkmp/devtool test
```
