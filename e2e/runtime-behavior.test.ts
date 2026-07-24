/**
 * T51 —— 产物行为测试（runtime 桥接验证）
 *
 * 在 Node 环境中 mock 全局 Page()/Component()，
 * 验证 runtime 的状态桥接、@Watch、createComponent 契约。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const runtimePath = require.resolve('@arkmp/runtime');
const runtimeFile = join(dirname(runtimePath), 'runtime.js');
const runtimeSource = readFileSync(runtimeFile, 'utf8');

/** 在隔离的 VM 上下文中加载 runtime 单文件，返回 exports。 */
function loadRuntime(): Record<string, unknown> {
  const moduleObj = { exports: {} as Record<string, unknown> };
  const fn = new Function('module', 'exports', 'require', runtimeSource);
  fn(moduleObj, moduleObj.exports, require);
  return moduleObj.exports;
}

describe('T51: runtime 行为测试', () => {
  let originalPage: unknown;
  let originalComponent: unknown;

  beforeEach(() => {
    originalPage = (globalThis as Record<string, unknown>).Page;
    originalComponent = (globalThis as Record<string, unknown>).Component;
  });
  afterEach(() => {
    (globalThis as Record<string, unknown>).Page = originalPage;
    (globalThis as Record<string, unknown>).Component = originalComponent;
  });

  it('runtime 单文件可加载且有导出', () => {
    const exports = loadRuntime();
    expect(exports).toBeDefined();
    expect(Object.keys(exports).length).toBeGreaterThan(0);
  });

  it('createPage 注册 Page 并设置 data', () => {
    const mockPage = vi.fn();
    (globalThis as Record<string, unknown>).Page = mockPage;

    const exports = loadRuntime();
    const createPage = exports.createPage as (opts: Record<string, unknown>) => void;

    createPage({ state: { count: 0 } });

    expect(mockPage).toHaveBeenCalledTimes(1);
    const config = mockPage.mock.calls[0][0];
    expect(config.data).toEqual({ count: 0 });
  });

  it('createPage 映射 ArkUI 生命周期到小程序钩子', () => {
    const mockPage = vi.fn();
    (globalThis as Record<string, unknown>).Page = mockPage;

    const exports = loadRuntime();
    const createPage = exports.createPage as (opts: Record<string, unknown>) => void;

    createPage({
      state: {},
      methods: {
        aboutToAppear() {},
        onPageShow() {},
      },
    });

    const config = mockPage.mock.calls[0][0];
    // aboutToAppear → onLoad
    expect(config.onLoad).toBeDefined();
    // onPageShow → onShow
    expect(config.onShow).toBeDefined();
  });

  it('createComponent 注册 Component 并设置 properties + data', () => {
    const mockComponent = vi.fn();
    (globalThis as Record<string, unknown>).Component = mockComponent;

    const exports = loadRuntime();
    const createComponent = exports.createComponent as (opts: Record<string, unknown>) => void;

    createComponent({
      properties: { name: { type: String, value: '' } },
      state: { local: 42 },
    });

    expect(mockComponent).toHaveBeenCalledTimes(1);
    const config = mockComponent.mock.calls[0][0];
    expect(config.properties).toBeDefined();
    expect(config.data).toEqual({ local: 42 });
  });

  it('createPage 在 onLoad 中安装状态桥接（attachState）', () => {
    const mockPage = vi.fn();
    (globalThis as Record<string, unknown>).Page = mockPage;

    const exports = loadRuntime();
    const createPage = exports.createPage as (opts: Record<string, unknown>) => void;

    createPage({
      state: { count: 0 },
      watch: { count: 'onCountChange' },
      methods: {
        onCountChange() {},
      },
    });

    const config = mockPage.mock.calls[0][0];
    // onLoad 被接管以安装状态桥接
    expect(config.onLoad).toBeDefined();
    expect(typeof config.onLoad).toBe('function');
  });

  it('BASE_WXSS 含基础布局类', () => {
    const exports = loadRuntime();
    const baseWxss = exports.BASE_WXSS as string;
    expect(baseWxss).toBeDefined();
    expect(baseWxss).toContain('arkmp-col');
    expect(baseWxss).toContain('arkmp-row');
  });
});
