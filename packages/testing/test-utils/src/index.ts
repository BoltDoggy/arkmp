import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, relative } from 'node:path';

/**
 * 一个 fixture 目录的内容。
 *
 * 约定目录结构：
 * ```text
 * fixtures/
 * └── <case-name>/
 *     ├── index.ets        # 输入源码（可多个 .ets）
 *     └── expected/        # 期望产物（可选）
 *         ├── index.wxml
 *         ├── index.wxss
 *         ├── index.js
 *         └── index.json
 * ```
 */
export interface Fixture {
  /** fixture 目录名 */
  name: string;
  /** fixture 目录路径 */
  dir: string;
  /** 输入源码：文件名（不含 .ets 后缀）→ 文件内容 */
  inputs: Record<string, string>;
  /** 期望产物：相对 expected/ 的路径 → 文件内容 */
  expected: Record<string, string>;
}

/** 列出 fixtures 根目录下的全部用例目录（按名称排序，保证测试顺序稳定）。 */
export function listFixtureDirs(root: string): string[] {
  return readdirSync(root)
    .filter((entry) => statSync(join(root, entry)).isDirectory())
    .sort()
    .map((entry) => join(root, entry));
}

/** 递归读取目录下全部文件，返回 相对路径 → 内容。 */
function readDirRecursive(dir: string, root: string = dir): Record<string, string> {
  const result: Record<string, string> = {};
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      Object.assign(result, readDirRecursive(full, root));
    } else {
      result[relative(root, full).split('\\').join('/')] = readFileSync(full, 'utf8');
    }
  }
  return result;
}

/** 加载一个 fixture 目录：顶层 `.ets` 为输入，`expected/` 子目录为期望产物。 */
export function loadFixture(dir: string): Fixture {
  const inputs: Record<string, string> = {};
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isFile() && entry.endsWith('.ets')) {
      inputs[basename(entry, '.ets')] = readFileSync(full, 'utf8');
    }
  }

  const expectedDir = join(dir, 'expected');
  const expected = statSync(expectedDir, { throwIfNoEntry: false })?.isDirectory()
    ? readDirRecursive(expectedDir)
    : {};

  return { name: basename(dir), dir, inputs, expected };
}

/** 实际产物与期望产物的差异报告。 */
export interface OutputDiff {
  /** 期望有而实际缺失的产物路径 */
  missing: string[];
  /** 实际多出的产物路径 */
  extra: string[];
  /** 两边都有但内容不一致的产物 */
  mismatched: Array<{ path: string; expected: string; actual: string }>;
}

/** 比对实际产物与期望产物（纯数据比对，不依赖测试框架）。 */
export function diffOutputs(
  actual: Record<string, string>,
  expected: Record<string, string>,
): OutputDiff {
  const missing: string[] = [];
  const mismatched: OutputDiff['mismatched'] = [];
  for (const [path, expectedContent] of Object.entries(expected)) {
    const actualContent = actual[path];
    if (actualContent === undefined) {
      missing.push(path);
    } else if (actualContent !== expectedContent) {
      mismatched.push({ path, expected: expectedContent, actual: actualContent });
    }
  }
  const extra = Object.keys(actual).filter((path) => !(path in expected));
  return { missing, extra, mismatched };
}

/** 差异报告是否为空（完全一致）。 */
export function hasDiff(diff: OutputDiff): boolean {
  return diff.missing.length > 0 || diff.extra.length > 0 || diff.mismatched.length > 0;
}

/** 将差异报告格式化为人类可读文本，用作断言失败消息。 */
export function formatDiff(diff: OutputDiff): string {
  const lines: string[] = [];
  for (const path of diff.missing) {
    lines.push(`缺失产物: ${path}`);
  }
  for (const path of diff.extra) {
    lines.push(`多余产物: ${path}`);
  }
  for (const { path, expected, actual } of diff.mismatched) {
    lines.push(`产物不一致: ${path}`, '--- 期望 ---', expected, '--- 实际 ---', actual);
  }
  return lines.join('\n');
}
