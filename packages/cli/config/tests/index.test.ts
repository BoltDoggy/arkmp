import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, CONFIG_DIAGNOSTIC_CODES, defineConfig, loadConfig, resolveConfig } from '../src/index';

let dir!: string;
afterEach(() => {
  if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
});

function writeConfig(content: string): string {
  dir = mkdtempSync(join(tmpdir(), 'arkmp-config-'));
  writeFileSync(join(dir, 'arkmp.config.ts'), content);
  return dir;
}

describe('defineConfig', () => {
  it('恒等返回入参', () => {
    const config = { appId: 'wx-test' };
    expect(defineConfig(config)).toBe(config);
  });
});

describe('loadConfig：无配置文件', () => {
  it('返回默认值且无诊断', () => {
    dir = mkdtempSync(join(tmpdir(), 'arkmp-config-'));
    const result = loadConfig(dir);
    expect(result.path).toBeUndefined();
    expect(result.diagnostics).toEqual([]);
    expect(result.config).toEqual(DEFAULT_CONFIG);
  });
});

describe('loadConfig：默认值合并', () => {
  it('用户字段覆盖默认，缺省字段回落默认', () => {
    writeConfig(`import { defineConfig } from '@arkmp/cli';
export default defineConfig({
  appId: 'wx1234567890abcdef',
  appName: '测试应用',
  compile: { sourcemap: true },
  window: { navigationBarBackgroundColor: '#ffffff' },
  tabBar: { pages: [{ name: 'Index', text: '首页', icon: 'assets/tab/home.png' }] },
  permission: { 'scope.userLocation': { desc: '用于展示附近门店' } },
  devServer: { autoOpenDevtool: true, devtoolPath: '/Applications/wechatwebdevtools.app' },
});
`);
    const result = loadConfig(dir);
    expect(result.diagnostics).toEqual([]);
    expect(result.path).toBe(join(dir, 'arkmp.config.ts'));
    expect(result.config).toEqual({
      appId: 'wx1234567890abcdef',
      appName: '测试应用',
      compile: { unitRatio: 2, sourcemap: true, minify: false },
      window: { navigationBarBackgroundColor: '#ffffff' },
      tabBar: { pages: [{ name: 'Index', text: '首页', icon: 'assets/tab/home.png' }] },
      permission: { 'scope.userLocation': { desc: '用于展示附近门店' } },
      devServer: { autoOpenDevtool: true, devtoolPath: '/Applications/wechatwebdevtools.app' },
    });
  });

  it('classPrefix 未设置时保持 undefined（不覆盖编译器内置前缀）', () => {
    writeConfig(`export default { compile: { classPrefix: 'a-' } };`);
    expect(loadConfig(dir).config.compile.classPrefix).toBe('a-');
    rmSync(dir, { recursive: true, force: true });

    writeConfig(`export default {};`);
    expect(loadConfig(dir).config.compile.classPrefix).toBeUndefined();
  });
});

describe('loadConfig：非法配置诊断', () => {
  it('字段类型非法 → error 诊断并回落默认值', () => {
    writeConfig(`export default {
  appId: 123,
  compile: { unitRatio: 'two', minify: 'yes' },
  tabBar: { pages: [{ name: 'Index' }] },
  devServer: { autoOpenDevtool: 'yes' },
};
`);
    const result = loadConfig(dir);
    const errors = result.diagnostics.filter((d) => d.level === 'error');
    expect(errors.map((d) => d.message)).toEqual([
      expect.stringContaining('appId'),
      expect.stringContaining('compile.unitRatio'),
      expect.stringContaining('compile.minify'),
      expect.stringContaining('tabBar'),
      expect.stringContaining('devServer.autoOpenDevtool'),
    ]);
    for (const d of errors) expect(d.code).toBe(CONFIG_DIAGNOSTIC_CODES.INVALID_FIELD);
    // 回落默认值
    expect(result.config.appId).toBeUndefined();
    expect(result.config.compile).toEqual({ unitRatio: 2, sourcemap: false, minify: false });
    expect(result.config.tabBar).toBeUndefined();
  });

  it('未知字段 → warning 诊断并忽略', () => {
    writeConfig(`export default { appid: 'wx-typo', compile: { ratio: 2, unitRatio: 3 } };`);
    const result = loadConfig(dir);
    const warnings = result.diagnostics.filter((d) => d.level === 'warning');
    expect(warnings.map((d) => d.message)).toEqual([
      expect.stringContaining('appid'),
      expect.stringContaining('compile.ratio'),
    ]);
    for (const d of warnings) expect(d.code).toBe(CONFIG_DIAGNOSTIC_CODES.UNKNOWN_FIELD);
    expect(result.config.compile.unitRatio).toBe(3);
  });

  it('默认导出不是对象 → error 诊断', () => {
    writeConfig(`export default 42;`);
    const result = loadConfig(dir);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]?.code).toBe(CONFIG_DIAGNOSTIC_CODES.NOT_AN_OBJECT);
    expect(result.config).toEqual(DEFAULT_CONFIG);
  });

  it('配置加载失败（不支持的 import）→ error 诊断', () => {
    writeConfig(`import fs from 'node:fs';
export default { appId: String(fs) };
`);
    const result = loadConfig(dir);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]?.code).toBe(CONFIG_DIAGNOSTIC_CODES.LOAD_FAILED);
    expect(result.diagnostics[0]?.message).toContain('node:fs');
  });
});

describe('resolveConfig（纯函数校验）', () => {
  it('undefined/null 输入返回默认值', () => {
    expect(resolveConfig(undefined).config).toEqual(DEFAULT_CONFIG);
    expect(resolveConfig(null).config).toEqual(DEFAULT_CONFIG);
  });
});
