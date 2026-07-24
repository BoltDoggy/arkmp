# @arkmp/test-utils

测试基建工具：提供 fixture 目录加载与编译产物快照比对，供各 transform / pipeline 包的 Vitest 单测使用。

## 所属层

测试基建层（`packages/testing/`，独立于 L0–L7 编译管线，不参与编译器依赖链）

## 依赖

无外部依赖（仅 devDependencies）。

## 导出 API

### `Fixture`

```ts
interface Fixture {
  name: string;
  dir: string;
  inputs: Record<string, string>;
  expected: Record<string, string>;
}
```

一个 fixture 目录的内容：

- `name`：fixture 目录名
- `dir`：fixture 目录绝对路径
- `inputs`：输入源码，文件名（不含 `.ets` 后缀）→ 文件内容
- `expected`：期望产物，相对 `expected/` 的路径 → 文件内容

约定的目录结构：

```text
fixtures/
└── <case-name>/
    ├── index.ets        # 输入源码（可多个 .ets）
    └── expected/        # 期望产物（可选）
        ├── index.wxml
        ├── index.wxss
        ├── index.js
        └── index.json
```

### `listFixtureDirs(root: string): string[]`

列出 fixtures 根目录下的全部用例子目录（按名称排序，保证测试顺序稳定）。`root` 为 fixtures 根目录路径，返回各用例目录的完整路径数组。

### `loadFixture(dir: string): Fixture`

加载一个 fixture 目录：顶层 `.ets` 文件为输入，`expected/` 子目录（如存在）为期望产物。返回 `Fixture` 对象。

### `OutputDiff`

```ts
interface OutputDiff {
  missing: string[];
  extra: string[];
  mismatched: Array<{ path: string; expected: string; actual: string }>;
}
```

实际产物与期望产物的差异报告：

- `missing`：期望有而实际缺失的产物路径
- `extra`：实际多出的产物路径
- `mismatched`：两边都有但内容不一致的产物

### `diffOutputs(actual: Record<string, string>, expected: Record<string, string>): OutputDiff`

比对实际产物与期望产物（纯数据比对，不依赖测试框架），返回 `OutputDiff`。

### `hasDiff(diff: OutputDiff): boolean`

差异报告是否为空（`true` 表示存在差异，即不一致）。

### `formatDiff(diff: OutputDiff): string`

将差异报告格式化为人类可读文本，用作断言失败消息。对缺失/多余产物逐行列出路径，对不一致产物分别输出期望与实际内容。

## 用法示例

```ts
import { listFixtureDirs, loadFixture, diffOutputs, hasDiff, formatDiff } from '@arkmp/test-utils';
import { describe, it, expect } from 'vitest';

describe('fixture 用例', () => {
  for (const dir of listFixtureDirs('./tests/fixtures')) {
    const fixture = loadFixture(dir);
    it(fixture.name, () => {
      const actual = compileFixture(fixture); // 你的编译函数
      const diff = diffOutputs(actual, fixture.expected);
      expect(hasDiff(diff), formatDiff(diff)).toBe(false);
    });
  }
});
```

## 测试

```bash
pnpm --filter @arkmp/test-utils test
```
