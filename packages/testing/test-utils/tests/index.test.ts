import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  diffOutputs,
  formatDiff,
  hasDiff,
  listFixtureDirs,
  loadFixture,
} from '@arkmp/test-utils';

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'arkmp-test-utils-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

/** 写一个最小 fixture：一个 .ets 输入 + expected/ 四件套。 */
function writeFixture(name: string): string {
  const dir = join(root, name);
  mkdirSync(join(dir, 'expected'), { recursive: true });
  writeFileSync(join(dir, 'index.ets'), '@Entry\nstruct Index {}\n');
  writeFileSync(join(dir, 'expected', 'index.wxml'), '<view/>\n');
  writeFileSync(join(dir, 'expected', 'index.js'), 'Page({});\n');
  return dir;
}

describe('listFixtureDirs', () => {
  it('按名称排序返回子目录', () => {
    writeFixture('b-case');
    writeFixture('a-case');
    writeFileSync(join(root, 'README.md'), 'not a dir');
    const dirs = listFixtureDirs(root);
    expect(dirs.map((d) => d.split('/').pop())).toEqual(['a-case', 'b-case']);
  });
});

describe('loadFixture', () => {
  it('读取 .ets 输入与 expected/ 期望产物', () => {
    const dir = writeFixture('basic');
    const fixture = loadFixture(dir);
    expect(fixture.name).toBe('basic');
    expect(fixture.inputs['index']).toContain('@Entry');
    expect(fixture.expected['index.wxml']).toBe('<view/>\n');
    expect(fixture.expected['index.js']).toBe('Page({});\n');
  });

  it('没有 expected/ 目录时期望产物为空', () => {
    const dir = join(root, 'no-expected');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.ets'), 'struct A {}\n');
    const fixture = loadFixture(dir);
    expect(fixture.expected).toEqual({});
  });

  it('expected/ 支持嵌套子目录', () => {
    const dir = writeFixture('nested');
    mkdirSync(join(dir, 'expected', 'pages'), { recursive: true });
    writeFileSync(join(dir, 'expected', 'pages', 'home.wxml'), '<view/>\n');
    const fixture = loadFixture(dir);
    expect(fixture.expected['pages/home.wxml']).toBe('<view/>\n');
  });
});

describe('diffOutputs', () => {
  const expected = { 'a.wxml': 'A', 'b.js': 'B' };

  it('完全一致时无差异', () => {
    const diff = diffOutputs({ 'a.wxml': 'A', 'b.js': 'B' }, expected);
    expect(hasDiff(diff)).toBe(false);
    expect(formatDiff(diff)).toBe('');
  });

  it('检出缺失 / 多余 / 不一致', () => {
    const diff = diffOutputs({ 'a.wxml': 'A!', 'c.wxss': 'C' }, expected);
    expect(hasDiff(diff)).toBe(true);
    expect(diff.missing).toEqual(['b.js']);
    expect(diff.extra).toEqual(['c.wxss']);
    expect(diff.mismatched).toEqual([{ path: 'a.wxml', expected: 'A', actual: 'A!' }]);
    const report = formatDiff(diff);
    expect(report).toContain('缺失产物: b.js');
    expect(report).toContain('多余产物: c.wxss');
    expect(report).toContain('产物不一致: a.wxml');
  });
});
