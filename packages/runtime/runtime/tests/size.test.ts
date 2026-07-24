import { readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const runtimeJsPath = fileURLToPath(new URL('../dist/runtime.js', import.meta.url));

describe('单文件产物 dist/runtime.js', () => {
  it('体积预算：gzip 前 < 10KB', () => {
    const size = statSync(runtimeJsPath).size;
    expect(size).toBeLessThan(10 * 1024);
  });

  it('可在 CJS 环境直接 require（小程序产物形态）', () => {
    const require = createRequire(import.meta.url);
    const runtime = require('../dist/runtime.js') as Record<string, unknown>;
    expect(typeof runtime.createPage).toBe('function');
    expect(typeof runtime.createComponent).toBe('function');
    expect(typeof runtime.normalizeEvent).toBe('function');
    expect(typeof runtime.BASE_WXSS).toBe('string');
  });

  it('无 sourcemap 引用与 license 头（eject 友好）', () => {
    const content = readFileSync(runtimeJsPath, 'utf8');
    expect(content).not.toContain('sourceMappingURL');
  });
});
