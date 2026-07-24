import { describe, it, expect } from 'vitest';
import { devtoolCliPath, DEFAULT_DEVTOOL_PATH, resolveDevtoolCli } from '../src/index.js';

describe('devtool paths', () => {
  it('devtoolCliPath 返回 macOS 包内 CLI 路径', () => {
    expect(devtoolCliPath()).toContain('Contents/MacOS/cli');
    expect(devtoolCliPath()).toContain(DEFAULT_DEVTOOL_PATH);
  });

  it('resolveDevtoolCli 不存在时返回诊断', () => {
    const result = resolveDevtoolCli('/nonexistent/app', { exists: () => false });
    expect(result.cli).toBeUndefined();
    expect(result.diagnostic).toBeDefined();
    expect(result.diagnostic?.code).toBe('E7101');
  });

  it('resolveDevtoolCli 存在时返回路径', () => {
    const result = resolveDevtoolCli('/nonexistent/app', { exists: () => true });
    expect(result.cli).toBeDefined();
    expect(result.cli).toContain('cli');
    expect(result.diagnostic).toBeUndefined();
  });
});
