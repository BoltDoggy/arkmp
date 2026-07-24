---
name: arkmp-debug
description: |
  ArkMP 编译排错与调试 skill。当 agent 协助使用方排查 ArkMP 编译错误、诊断警告、
  调试运行时行为或解决产物问题时，必须按本 skill 规定的流程与方法执行。
  本 skill 适用于解读诊断码、定位编译错误、排查样式/组件映射异常、调试运行时问题等任务。
---

# arkmp-debug — 编译排错与调试

## 1. 原则声明

> **诊断先行**：ArkMP 的诊断系统是排错的第一入口。所有编译期问题都以结构化诊断码 +
> 源码位置报告。Agent 必须先读懂诊断信息，再定位根因，最后给出修复方案。
> 不要在没有诊断信息的情况下猜测问题。

## 2. 排错流程

```text
① 运行 ark-mp check / ark-mp build，收集诊断信息
   │
   ▼
② 按诊断码段定位问题类别（E1xxx/W2xxx/E3xxx/...）
   │
   ▼
③ 阅读诊断信息中的 file:line:column 定位源码位置
   │
   ▼
④ 查看 help 字段获取修复建议
   │
   ▼
⑤ 修复源码或配置
   │
   ▼
⑥ 重新运行 ark-mp check 确认诊断消除
```

## 3. 诊断格式

ArkMP 诊断输出格式：

```text
arkmp E1023 [pages/Index.ets:24:9]
  不支持的组件：Video（小程序端请使用 ArkMP 的 <Video> 适配组件）
  帮助：见 docs/arkui-miniprogram/03-component-mapping.md#视频
```

字段说明：

| 字段 | 说明 |
| --- | --- |
| `arkmp` | 工具标识 |
| `E1023` / `W2xxx` | 诊断码（E=error 阻断构建，W=warning 不阻断） |
| `[file:line:column]` | 源码位置 |
| 正文 | 问题描述 |
| `帮助：` | 修复建议或文档链接（可选） |

## 4. 诊断码速查表

### 4.1 码段总览

| 码段 | 级别 | 含义 | 阻断构建 |
| --- | --- | --- | --- |
| E1xxx | error | 语法/组件不可编译 | ✅ |
| W2xxx | warning | 状态写法降级（Proxy 兜底） | ❌ |
| E3xxx | error | 平台能力缺失（含 wx API 直接调用） | ✅ |
| W4xxx | warning | 样式降级（属性不支持，已忽略或近似） | ❌ |
| E5xxx | error | 工程配置错误（路由冲突、tabBar 不一致） | ✅ |
| E7001–E7003 | error | 配置文件加载/校验失败 | ✅ |
| W7001 | warning | 配置文件含未知字段 | ❌ |
| E7101–E7103 | error | 开发者工具 / CI 问题 | ✅ |
| E8001–E8002 | error | CLI 运行时问题（文件找不到等） | ✅ |

### 4.2 常见 error 诊断

| 诊断码 | 含义 | 原因 | 修复 |
| --- | --- | --- | --- |
| E1001 | LazyForEach 不支持 | 使用了 `LazyForEach` + IDataSource | 改用 `ForEach` + scroll-view 分页 |
| E1002 | 动画编排不支持 | `animateTo` 闭包外编排或 `keyframeAnimateTo` | 改用 CSS transition / @keyframes |
| E1003 | 共享元素转场不支持 | `geometryTransition` | 移除或降级为无动画 |
| E1004 | Worker 不支持 | `@Concurrent` / worker | 使用小程序 worker API |
| E1005 | 动态组件不支持 | `wrapBuilder` / `@LocalBuilder` | 用 `@Builder` 或独立组件 |
| E3xxx | 平台能力缺失 | 源码调用小程序不存在的能力（卡片、流转等） | 移除该调用或用替代方案 |
| E3xxx | 源码中直接调用 setData/wx.* | 源码中写了小程序 API | 使用 `@arkmp/api` 命名空间 |
| E5xxx | 路由表冲突 | 页面名重复或路由配置不一致 | 检查 `@Entry` 页面命名 |
| E5xxx | tabBar 不一致 | tabBar 页面集合与 app.json 不一致 | 检查 `arkmp.config.ts` 的 `tabBar` |
| E7001 | 配置加载失败 | `arkmp.config.ts` 语法错误 | 检查 TS 语法 |
| E7002 | 配置导出非对象 | `export default` 不是对象 | 确保 `defineConfig({...})` |
| E7003 | 配置字段类型错误 | 如 `unitRatio` 传了字符串 | 按类型规范填写 |
| E8001 | 文件找不到 | 指定的 `.ets` 文件不存在 | 检查路径 |
| E8002 | runtime 找不到 | `--runtime-path` 指定的路径不存在 | 检查路径或去掉该选项 |

### 4.3 常见 warning 诊断

| 诊断码 | 含义 | 影响 | 建议 |
| --- | --- | --- | --- |
| W2001 | 动态属性访问 `this[key]` | 走 Proxy 兜底，性能下降 | 改用显式字段名 |
| W2xxx | 状态引用传递后修改 | 走 Proxy 兜底 | 避免引用传递，用直接赋值 |
| W4xxx | 样式属性不支持 | 该属性被忽略或近似 | 查阅样式白名单，使用支持的属性 |
| W2xxx | ForEach 缺少键函数 | 回退 `wx:key="index"` | 添加键生成函数 `(item) => item.id` |
| W2xxx | 页面栈过深 | runtime warning | 减少连续 `router.push` |
| W2xxx | setData 数据过大 | 可能影响性能 | 避免内嵌大 JSON 初始状态 |
| W7001 | 配置含未知字段 | 该字段被忽略 | 移除未知字段 |

## 5. 排查工具

### 5.1 `ark-mp check` — 编译期诊断

```bash
ark-mp check src/          # 只跑诊断，不产出
```

适用场景：快速验证源码是否可编译，不需要等待完整构建。

### 5.2 `ark-mp doctor` — 环境检查

```bash
ark-mp doctor
```

检查项：

| 检查项 | 要求 | 不满足时 |
| --- | --- | --- |
| Node.js | ≥ 18 | 提示升级 |
| 微信开发者工具 CLI | 已安装且可调用 | 提示安装路径配置 |
| appId | `arkmp.config.ts` 中已填写 | 提示填写 |

**建议在遇到任何环境性问题时首先运行 `ark-mp doctor`。**

### 5.3 `ark-mp build` — 完整构建

```bash
ark-mp build
```

构建时会输出：
- 编译诊断（error/warning）
- 产物体积报告（主包/整包大小）
- 域名扫描清单（源码中的 request 域名，需在小程序后台配置）

### 5.4 sourcemap 调试

开启配置：

```ts
export default defineConfig({
  compile: {
    sourcemap: true    // 默认 false
  }
});
```

- JS 产物带 sourcemap，微信开发者工具 Sources 面板直接显示 `.ets` 源码。
- 编译诊断以源码位置报告（`.ets` 文件的行号）。
- runtime 错误在 console 中带 `[arkmp]` 前缀与组件名。

## 6. 常见问题排查

### 6.1 编译报错：组件不支持

**现象**：`E1xxx` 诊断，提示组件不支持。

**排查**：
1. 查阅组件映射表（`arkmp-mapping` skill 第 2 节）确认该组件是否在支持列表；
2. 如果在不支持列表中（如 `RelativeContainer`），使用替代组件（`Column`/`Row`/`Stack`）；
3. 如果是降级组件（如 `WaterFlow`），确认是否接受降级行为。

### 6.2 样式不生效

**现象**：某个样式修饰符在产物中没有体现。

**排查**：
1. 检查该修饰符是否在样式白名单中（`arkmp-mapping` skill 第 3.3 节）；
2. 不在白名单的修饰符会产生 W4xxx warning 并生成注释 `/* arkmp: unsupported .xxx() */`；
3. 运行 `ark-mp check src/` 查看 warning 列表；
4. 使用白名单中的等价属性替代。

### 6.3 状态更新后页面不刷新

**现象**：修改了 `@State` 但 UI 没有变化。

**排查**：
1. 检查状态写法是否是推荐写法（直接赋值 `this.xxx = v`），而非引用传递后修改；
2. 引用传递后修改会走 Proxy 兜底（W2xxx warning），检查 console 中是否有 `[arkmp]` 相关警告；
3. 如果是嵌套对象修改（`this.user.name = 'x'`），确认编译器正确改写为 `setData({ 'user.name': 'x' })`；
4. 检查 `@Watch` 回调是否正确触发（在 setData 回调中调用）。

### 6.4 事件回调不触发

**现象**：点击按钮后回调没有执行。

**排查**：
1. 检查源码中使用的事件修饰符（如 `.onClick`），确认在事件映射表中（`arkmp-mapping` skill 第 5 节）；
2. 检查产物 WXML 中是否正确生成了 `bindtap` / `bindinput` 等绑定；
3. 检查产物 JS 中是否生成了对应的方法（命名 `__{nodeId}_{event}`）。

### 6.5 页面路由不工作

**现象**：`router.push` 后页面没有跳转。

**排查**：
1. 确认目标页面有 `@Entry` 装饰器；
2. 确认 `router.push({ name: 'Detail' })` 中的 `name` 与页面类名一致；
3. 检查页面栈深度（小程序限制 10 层），过深会 warning；
4. tab 页面必须用 `router.switchTab`，不能用 `router.push`。

### 6.6 tabBar 不显示

**现象**：配置了 tabBar 但底部没有出现。

**排查**：
1. 检查 `arkmp.config.ts` 的 `tabBar.pages` 中每个 `name` 是否对应一个 `@Entry` 页面；
2. 检查 `icon` 路径是否存在（相对于 `dist/`）；
3. 运行 `ark-mp build` 检查是否有 E5xxx 路由一致性错误。

### 6.7 API 调用失败

**现象**：`http.request` 或其他 API 报错。

**排查**：
1. 确认源码使用 `@arkmp/api` 命名空间（`http.request`），而非直接调用 `wx.request`；
2. 检查 `request` 域名是否已在小程序后台配置白名单；
3. 运行 `ark-mp check src/`，编译器会扫描源码中的域名并生成待配置清单；
4. 确认 API 是否在不支持列表中（如 `form.createCard` → E3001）。

### 6.8 包体积超限

**现象**：`ark-mp build` 报告主包超过 2MB。

**排查**：
1. 检查 `src/resources/media/` 下是否有大图片，考虑压缩或使用网络图片；
2. 检查初始状态数据是否过大（内嵌大 JSON），编译器会 warning；
3. 考虑使用小程序分包（将部分页面拆为子包）；
4. 确保 `compile.minify: true`。

### 6.9 开发者工具无法打开

**现象**：`ark-mp dev` 启动但开发者工具没有打开。

**排查**：
1. 运行 `ark-mp doctor` 检查开发者工具 CLI 是否可用；
2. 检查 `arkmp.config.ts` 的 `devServer.devtoolPath` 是否指向正确的开发者工具安装路径；
3. macOS 默认路径：`/Applications/wechatwebdevtools.app`；
4. 确认开发者工具"设置 → 安全设置"中已开启"服务端口"。

## 7. runtime 错误排查

runtime 错误在微信开发者工具 console 中带 `[arkmp]` 前缀：

```text
[arkmp][Index] TypeError: Cannot read property 'name' of undefined
```

常见 runtime 错误：

| 错误 | 原因 | 修复 |
| --- | --- | --- |
| `Cannot read property 'x' of undefined` | 访问了未初始化的嵌套对象属性 | 确保 `@State` 初始值完整 |
| `[arkmp] Proxy set` | 状态走 Proxy 兜底（W2xxx） | 改为推荐写法 |
| `[arkmp] page stack overflow` | 页面栈超过 10 层 | 用 `router.replace` 替代部分 `push` |
| `[arkmp] derived recalculation failed` | 派生字段重算出错 | 检查派生依赖的方法是否有副作用 |

## 8. 调试最佳实践

1. **始终开启 sourcemap**（开发环境）：`compile.sourcemap: true`，可直接在开发者工具中看到 `.ets` 源码。
2. **先用 `ark-mp check` 再 `ark-mp dev`**：快速捕获编译期问题，避免在运行时才发现。
3. **关注 warning**：W2xxx 和 W4xxx 虽然不阻断构建，但会影响性能或导致样式缺失。
4. **产物可读**：`dist/` 中的产物是接近手写的标准小程序代码，可直接检查 WXML/WXSS/JS 确认转换结果。
5. **增量定位**：如果不确定问题出在哪个阶段，对比 `.ets` 源码和 `dist/` 产物，找到第一个不一致的产物文件。

## 9. 检查清单

排查问题时，确认以下步骤：

- [ ] 运行 `ark-mp doctor` 确认环境正常
- [ ] 运行 `ark-mp check src/` 收集完整诊断列表
- [ ] 按诊断码段分类问题（E1xxx 语法 / W2xxx 状态 / W4xxx 样式 / E3xxx API / E5xxx 配置）
- [ ] 阅读诊断信息的 `file:line:column` 和 `help` 字段
- [ ] 对照映射表（`arkmp-mapping` skill）确认预期转换结果
- [ ] 检查 `dist/` 产物确认实际转换结果
- [ ] 开启 sourcemap 后在开发者工具中调试 runtime 问题
- [ ] 修复后重新运行 `ark-mp check` 确认诊断消除
