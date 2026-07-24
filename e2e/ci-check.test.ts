/**
 * T53 —— CI 可用性验证
 *
 * 验证全量 build/test 在干净环境可跑通的关键断言。
 */
import { describe, it, expect } from 'vitest';
import { existsSync, statSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';

const require = createRequire(import.meta.url);
// 从 e2e/ 向上找仓库根
const repoRoot = join(process.cwd(), '..');

describe('T53: CI 可用性', () => {
  describe('对外发布包可被解析', () => {
    // types 是纯 d.ts 包，没有运行时入口，特殊处理
    const resolvablePackages = [
      '@arkmp/cli',
      '@arkmp/compiler',
      '@arkmp/runtime',
      '@arkmp/api',
      '@arkmp/eslint-plugin',
    ];

    for (const pkg of resolvablePackages) {
      it(`${pkg} 可被 require 解析`, () => {
        const resolved = require.resolve(pkg);
        expect(existsSync(resolved)).toBe(true);
      });
    }

    it('@arkmp/types 包目录存在且有 index.d.ts', () => {
      const typesDir = join(repoRoot, 'packages/source-side/types');
      expect(existsSync(join(typesDir, 'index.d.ts'))).toBe(true);
    });
  });

  it('runtime 单文件产物存在且 <10KB', () => {
    const runtimeDist = require.resolve('@arkmp/runtime');
    const singleFile = join(dirname(runtimeDist), 'runtime.js');
    expect(existsSync(singleFile)).toBe(true);
    const size = statSync(singleFile).size;
    expect(size).toBeLessThan(10240);
  });

  it('cli bin 入口存在', () => {
    // 直接从包目录读 package.json（绕过 exports 限制）
    const cliPkgPath = join(repoRoot, 'packages/cli/cli/package.json');
    const cliPkg = JSON.parse(
      require('node:fs').readFileSync(cliPkgPath, 'utf8'),
    ) as { bin: Record<string, string> };
    expect(cliPkg.bin).toBeDefined();
    expect(cliPkg.bin['ark-mp']).toBeDefined();
  });

  it('所有 workspace 包均有 package.json', () => {
    const workspaceRoots = [
      'packages/core',
      'packages/frontend',
      'packages/transforms',
      'packages/backend',
      'packages/compiler',
      'packages/runtime',
      'packages/source-side',
      'packages/cli',
      'packages/testing',
    ];
    for (const layer of workspaceRoots) {
      const layerPath = join(repoRoot, layer);
      if (!existsSync(layerPath)) continue;
      const entries = readdirSync(layerPath, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const pkgJson = join(layerPath, entry.name, 'package.json');
        expect(existsSync(pkgJson)).toBe(true);
      }
    }
  });

  it('pnpm-workspace.yaml 存在', () => {
    expect(existsSync(join(repoRoot, 'pnpm-workspace.yaml'))).toBe(true);
  });

  it('tsconfig.base.json 存在', () => {
    expect(existsSync(join(repoRoot, 'tsconfig.base.json'))).toBe(true);
  });
});
