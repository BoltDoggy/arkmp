# @arkmp/pipeline

将单个 `.ets` 源文件编译为小程序四件套（WXML/WXSS/JS/JSON）的六阶段管线编排，纯函数无 I/O。

## 所属层

L4 compiler（编译内核）

## 依赖

| 依赖 | 原因 |
| --- | --- |
| `@arkmp/parser` | ① 阶段：`.ets` → TS AST + 位置映射 |
| `@arkmp/analyzer` | ②③ 阶段：AST → ComponentModel |
| `@arkmp/transform-events` | ④ 事件链：抽取事件表与回调方法 |
| `@arkmp/transform-wxss` | ④ 样式链：styleCalls → WXSS 类 |
| `@arkmp/transform-wxml` | ④ 结构链：buildTree → WXML |
| `@arkmp/transform-js` | ④⑤ 脚本链：model → createPage/createComponent |
| `@arkmp/transform-json` | ⑤ 配置链：model → 页面/组件 json |
| `@arkmp/emitter` | ⑤ 四件套拼装 + sourcemap |
| `@arkmp/diagnostics` | 诊断类型定义与汇总 |
| `@arkmp/ir` | ComponentModel 类型定义 |

## 导出 API

### `compile(source: string, options?: CompileOptions): CompileResult`

编译入口。纯函数编排全部六阶段，同一输入产出完全一致。`source` 为 `.ets` 源码字符串；返回 `CompileResult`，包含四件套产物、全阶段诊断、核心 IR 及 `hasErrors` 标记。有 error 级诊断时仍返回部分产物，由调用方按 `hasErrors` 判定是否阻断。

### `CompileOptions`

编译选项接口：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `fileName?` | `string` | 源文件名，产物路径由其派生，缺省 `index.ets` |
| `unitRatio?` | `number` | vp→rpx 换算系数，默认 2 |
| `classPrefix?` | `string` | WXSS 类名前缀，默认 `arkmp-` |
| `sourcemap?` | `boolean` | 是否生成 `.js.map`（v3，sources 指回 .ets） |
| `isPage?` | `boolean` | 强制按页面/组件产物生成；缺省按 `@Entry` 推断 |

### `CompileResult`

编译结果接口：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `files` | `EmittedFile[]` | 四件套产物（`sourcemap: true` 时含 `.js.map`），按 wxml/wxss/js/json 序 |
| `diagnostics` | `Diagnostic[]` | 全阶段汇总诊断，位置已回溯原始源码 |
| `model` | `ComponentModel` | 编译核心 IR，供增量缓存、依赖分析等上层使用 |
| `hasErrors` | `boolean` | 是否存在 error 级诊断 |

## 用法示例

```ts
import { compile } from '@arkmp/pipeline';

const source = `
@Entry
@Component
struct Index {
  @State count: number = 0
  build() {
    Column() {
      Text('count = ' + this.count)
    }
  }
}
`;

const result = compile(source, { fileName: 'pages/index/Index.ets', sourcemap: true });
console.log(result.hasErrors ? '有错误' : '编译成功');
for (const file of result.files) {
  console.log(file.path, file.content.length, 'bytes');
}
```

## 测试

```bash
pnpm --filter @arkmp/pipeline test
```
