# @arkmp/config

`arkmp.config.ts` 配置文件的加载、schema 校验与默认值合并。

## 所属层

L7 命令行层（cli），负责读取并校验用户工程配置，为 `@arkmp/cli` 和 `@arkmp/compiler` 提供 `ResolvedConfig`。

## 依赖

- `@arkmp/diagnostics`（`workspace:*`）—— 校验配置时使用结构化诊断模型报 error（字段类型非法）和 warning（未知字段）。
- `typescript` —— 在沙箱中转译 `arkmp.config.ts` 为 CJS 后求值。

## 导出 API

### `CONFIG_DIAGNOSTIC_CODES`

```ts
const CONFIG_DIAGNOSTIC_CODES: {
  LOAD_FAILED: 'E7001';      // 配置文件存在但加载/求值失败
  NOT_AN_OBJECT: 'E7002';    // 配置整体不是对象
  INVALID_FIELD: 'E7003';    // 字段类型非法（回落默认值）
  UNKNOWN_FIELD: 'W7001';    // 未知字段（忽略）
};
```

config 包的诊断码常量。

### `CompileConfig`

```ts
interface CompileConfig {
  unitRatio?: number;     // vp → rpx 换算系数，默认 2
  sourcemap?: boolean;    // js 产物 sourcemap，默认 false
  minify?: boolean;       // 构建时压缩，默认 false（当前版本暂未实现）
  classPrefix?: string;   // 样式类名前缀，未设置时用编译器内置前缀
}
```

编译段配置。

### `TabBarConfig`

```ts
interface TabBarConfig {
  pages: Array<{ name: string; text: string; icon?: string }>;
}
```

tabBar 配置，`pages` 按页面 struct 名引用，映射到 `app.json.tabBar`。

### `DevServerConfig`

```ts
interface DevServerConfig {
  autoOpenDevtool?: boolean;  // dev 时自动唤起微信开发者工具，默认 false
  devtoolPath?: string;       // 开发者工具安装路径
}
```

dev 模式配置。

### `ArkmpConfig`

```ts
interface ArkmpConfig {
  appId?: string;                        // 小程序 appId（存在时生成 project.config.json）
  appName?: string;                      // 应用名（project.config.json 的 projectname）
  compile?: CompileConfig;
  window?: Record<string, unknown>;      // 全局窗口配置 → app.json.window
  tabBar?: TabBarConfig;
  permission?: Record<string, unknown>;  // 权限声明 → app.json.permission
  devServer?: DevServerConfig;
}
```

`arkmp.config.ts` 的用户配置形态，全部字段可选。

### `ResolvedConfig`

```ts
interface ResolvedConfig extends Omit<ArkmpConfig, 'compile'> {
  compile: Required<Pick<CompileConfig, 'unitRatio' | 'sourcemap' | 'minify'>> &
    Pick<CompileConfig, 'classPrefix'>;
}
```

合并默认值后的配置：`compile` 段的 `unitRatio`/`sourcemap`/`minify` 已补齐为必填。

### `LoadConfigResult`

```ts
interface LoadConfigResult {
  config: ResolvedConfig;    // 校验 + 默认值合并后的配置
  path?: string;             // 配置文件绝对路径；未找到为 undefined
  diagnostics: Diagnostic[]; // 加载与校验诊断
}
```

`loadConfig` 的返回值。

### `DEFAULT_CONFIG`

```ts
const DEFAULT_CONFIG: ResolvedConfig;
```

默认配置：`{ compile: { unitRatio: 2, sourcemap: false, minify: false } }`。

### `defineConfig(config: ArkmpConfig): ArkmpConfig`

类型辅助函数（恒等返回入参）。在配置文件中调用仅为获得字段类型提示，不做任何运行时处理。

### `resolveConfig(raw: unknown): { config: ResolvedConfig; diagnostics: Diagnostic[] }`

校验并合并用户配置对象。非法字段报 error 诊断并回落默认值；未知字段报 warning 诊断并忽略。`raw` 为 `undefined`/`null` 时返回默认配置（无诊断）。

### `loadConfig(cwd?: string): LoadConfigResult`

查找并加载 `cwd/arkmp.config.ts`：读取源码 → TypeScript 转译为 CJS → 沙箱求值 → `resolveConfig` 校验合并。找不到配置文件时返回默认值（diagnostics 为空）。配置文件中 `require('@arkmp/cli')` 或 `require('@arkmp/config')` 会获得 `defineConfig`，其余 import 抛错。

## 用法示例

```ts
import { defineConfig } from '@arkmp/config';

// arkmp.config.ts —— 用户工程中
export default defineConfig({
  appId: 'wx1234567890abcdef',
  appName: 'my-app',
  compile: { unitRatio: 2, sourcemap: true },
  tabBar: {
    pages: [
      { name: 'Index', text: '首页' },
      { name: 'Mine', text: '我的' },
    ],
  },
});
```

```ts
import { loadConfig } from '@arkmp/config';

// 编译器内部加载配置
const { config, path, diagnostics } = loadConfig(process.cwd());
if (diagnostics.some((d) => d.level === 'error')) {
  console.error(diagnostics);
  process.exit(1);
}
console.log(config.compile.unitRatio); // 2
```

## 测试

```bash
pnpm --filter @arkmp/config test
```
