# @arkmp/eslint-plugin

> 对外发布包

ArkMP 源码侧（`.ets`）编码期越界语法检查。每条规则对应 `docs/arkui-miniprogram/08-limitations.md` 的一条限制，在编码期给出与编译期一致的诊断（E1xxx / W2xxx / E3xxx 语义）。

## 所属层

L6 source-side（独立子树）。

## 依赖

无 workspace 依赖。运行依赖 `@typescript-eslint/utils`，并以 `eslint`（`^9.0.0`）与 `typescript`（`^5.0.0`）为 peerDependency——前者提供规则运行环境，后者提供类型信息。

## 导出 API

### `rules`

全部 14 条规则的对象表，键为规则名（如 `'no-unknown-decorator'`）。每条规则基于 `@typescript-eslint/utils` 的 `RuleCreator` 创建，文档链接统一指向 08 篇对应锚点。其中 13 条对应编译期限制（08 篇 E1xxx / W2xxx / E3xxx），1 条为 ArkTS 编码风格建议（`no-var`，无编译期诊断码）。

### `recommendedRules: Record<'arkmp/${RuleName}', 'error' | 'warn'>`

recommended 配置的规则级别。E 级（编译期 error）为 `'error'`，W 级（降级提示）为 `'warn'`，与 08 篇诊断级别对齐。

### `configs`

flat config 形式的配置对象表，当前含 `recommended`（注册 `arkmp` 插件并启用 `recommendedRules`）。

### `default`（默认导出）

ESLint 插件对象，含 `meta`（`name`/`version`）、`rules`、`configs`。

### `RuleName`（类型）

`keyof typeof rules`，全部规则名的联合类型。

### 规则清单

| 规则 | 级别 | 说明 |
| --- | --- | --- |
| `no-unknown-decorator` | error | 禁止白名单之外的装饰器（08 篇装饰器白名单） |
| `no-ui-call-outside-build` | error | 禁止在 `build()` / `@Builder` 之外调用 UI 组件 |
| `no-side-effect-in-build` | error | 禁止在 `build()` 中修改状态或发起副作用调用 |
| `single-root-node` | error | `build()` 最多一个根节点 |
| `no-lazy-foreach` | error | 禁止 `LazyForEach` / `IDataSource`（08 篇 E1001） |
| `no-geometry-transition` | error | 禁止 `geometryTransition` 共享元素转场（08 篇 E1003） |
| `no-concurrent` | error | 禁止 `@Concurrent` 并发装饰器（08 篇 E1004） |
| `no-wrap-builder` | error | 禁止 `wrapBuilder` / `@LocalBuilder` 动态组件（08 篇 E1005） |
| `no-dynamic-this-access` | warn | 禁止 `this[key]` 动态属性访问（08 篇 W2001，降级 Proxy 兜底） |
| `no-unsupported-component` | error | 禁止不可编译的 ArkUI 组件（08 篇 E1xxx） |
| `no-degraded-capability` | warn | 提示将降级处理的 ArkUI 能力（08 篇组件能力表，warning 级） |
| `no-miniprogram-api` | error | 禁止直接使用 `wx.*` / `this.data` / `setData` 等产物 API（08 篇 E3xxx） |
| `require-literal-decorator-args` | error | `@Watch`/`@StorageLink` 参数必须为字符串字面量（编译期静态求值） |
| `no-var` | warn | 禁止 `var` 声明，改用 `let` / `const`（08 篇 ArkTS 编码风格建议，非编译限制） |

## 用法示例

```ts
import arkmp from '@arkmp/eslint-plugin';

// flat config
export default [
  arkmp.configs.recommended,
  // 或按需启用单条规则
  // { plugins: { arkmp }, rules: { 'arkmp/no-unknown-decorator': 'error' } },
];
```

```json
// eslint.config.js 引入后，.ets 源码中越界写法会被标记
// 例：@Foo 装饰器不在白名单 → no-unknown-decorator 报错
// 例：this.setData({}) → no-miniprogram-api 报错
```

## 测试

```bash
pnpm --filter @arkmp/eslint-plugin test
```
