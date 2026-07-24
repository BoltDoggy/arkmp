# @arkmp/templates

`ark-mp init` 脚手架模板：内置 `default` / `demo` 两套模板，提供变量替换与目录渲染能力。

## 所属层

L7 命令行层（cli），为 `@arkmp/cli` 的 `init` 命令提供模板文件与渲染函数。

## 依赖

无 workspace 依赖。仅使用 Node.js 内置模块（`node:fs`、`node:path`、`node:url`）。

## 模板说明

模板文件存放于包内 `templates/<name>/` 目录（纯文本，原样拷贝），渲染时做两处变量替换：

- `{{projectName}}` → 工程名（init 的 `<name>` 参数）
- `{{appId}}` → 小程序 appId（缺省用占位符 `wx1234567890abcdef`）

内置模板：

| 模板 | 内容 |
| --- | --- |
| `default` | 最小工程：`arkmp.config.ts` + `package.json` + `tsconfig.json` + `app.ets` + 1 个 @Entry 页面（`Index`）+ 1 个自定义组件（`UserCard`） |
| `demo` | 在 `default` 基础上增加 `detail`/`mine` 示例页面与 tabBar 配置 |

## 导出 API

### `TemplateName`

```ts
type TemplateName = 'default' | 'demo';
```

内置模板名类型。

### `RenderVariables`

```ts
interface RenderVariables {
  projectName: string;  // 工程名 → {{projectName}}
  appId?: string;       // 小程序 appId → {{appId}}，缺省为占位符
}
```

模板渲染变量。

### `PLACEHOLDER_APP_ID`

```ts
const PLACEHOLDER_APP_ID = 'wx1234567890abcdef';
```

占位 appId，用户在生成的 `arkmp.config.ts` 中替换为真实 appId。

### `listTemplates(): TemplateName[]`

列出 `templates/` 下的子目录名（即内置模板名），按字母序排序。

### `renderTemplate(name: TemplateName, targetDir: string, vars: RenderVariables): string[]`

将模板 `name` 渲染到目标目录 `targetDir`。目录不存在时自动创建；已存在的同名文件会被覆盖。返回写入的文件列表（相对 `targetDir` 的 posix 路径，排序）。传入未知模板名时抛异常。

## 用法示例

```ts
import { renderTemplate, listTemplates } from '@arkmp/templates';

// 列出可用模板
console.log(listTemplates()); // ['default', 'demo']

// 用 default 模板初始化工程
const written = renderTemplate('default', './my-app', {
  projectName: 'my-app',
  appId: 'wxabcdef1234567890',
});
console.log(written);
// ['arkmp.config.ts', 'package.json', 'src/app.ets',
//  'src/components/UserCard.ets', 'src/pages/index/Index.ets', 'tsconfig.json']
```

## 测试

```bash
pnpm --filter @arkmp/templates test
```
