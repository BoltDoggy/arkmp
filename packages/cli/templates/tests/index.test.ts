import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { listTemplates, PLACEHOLDER_APP_ID, renderTemplate } from '../src/index';

let dir!: string;
afterEach(() => {
  if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
});

function render(name: 'default' | 'demo', vars: Parameters<typeof renderTemplate>[2]): string[] {
  dir = mkdtempSync(join(tmpdir(), 'arkmp-template-'));
  return renderTemplate(name, dir, vars);
}

describe('listTemplates', () => {
  it('内置 default 与 demo 两种模板', () => {
    expect(listTemplates()).toEqual(['default', 'demo']);
  });
});

describe('renderTemplate：default', () => {
  it('生成 07 篇最小工程结构', () => {
    const written = render('default', { projectName: 'my-app' });
    expect(written).toEqual([
      'arkmp.config.ts',
      'package.json',
      'src/app.ets',
      'src/components/UserCard.ets',
      'src/pages/index/Index.ets',
      'tsconfig.json',
    ]);
  });

  it('变量替换：工程名与 appId 占位符', () => {
    render('default', { projectName: 'my-app' });
    const config = readFileSync(join(dir, 'arkmp.config.ts'), 'utf8');
    expect(config).toContain(`appId: '${PLACEHOLDER_APP_ID}'`);
    expect(config).toContain(`appName: 'my-app'`);
    expect(config).not.toContain('{{');

    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as Record<string, unknown>;
    expect(pkg.name).toBe('my-app');

    const page = readFileSync(join(dir, 'src/pages/index/Index.ets'), 'utf8');
    expect(page).toContain(`UserCard({ name: 'my-app' })`);
  });

  it('显式 appId 覆盖占位符', () => {
    render('default', { projectName: 'my-app', appId: 'wx-real-id' });
    expect(readFileSync(join(dir, 'arkmp.config.ts'), 'utf8')).toContain(`appId: 'wx-real-id'`);
  });

  it('渲染产物快照', () => {
    const written = render('default', { projectName: 'my-app' });
    const snapshot = written
      .map((p) => `=== ${p} ===\n${readFileSync(join(dir, p), 'utf8')}`)
      .join('\n');
    expect(snapshot).toMatchSnapshot();
  });
});

describe('renderTemplate：demo', () => {
  it('带更多示例页面与 tabBar 配置', () => {
    const written = render('demo', { projectName: 'demo-app' });
    expect(written).toEqual([
      'arkmp.config.ts',
      'package.json',
      'src/app.ets',
      'src/components/UserCard.ets',
      'src/pages/detail/Detail.ets',
      'src/pages/index/Index.ets',
      'src/pages/mine/Mine.ets',
      'tsconfig.json',
    ]);

    const config = readFileSync(join(dir, 'arkmp.config.ts'), 'utf8');
    expect(config).toContain('tabBar');
    expect(config).toContain(`{ name: 'Index', text: '首页' }`);
    expect(config).toContain(`{ name: 'Mine', text: '我的' }`);
  });

  it('渲染产物快照', () => {
    const written = render('demo', { projectName: 'demo-app' });
    const snapshot = written
      .map((p) => `=== ${p} ===\n${readFileSync(join(dir, p), 'utf8')}`)
      .join('\n');
    expect(snapshot).toMatchSnapshot();
  });
});

describe('renderTemplate：错误处理', () => {
  it('未知模板名抛错并列出可选模板', () => {
    dir = mkdtempSync(join(tmpdir(), 'arkmp-template-'));
    expect(() => renderTemplate('nope' as 'default', dir, { projectName: 'x' })).toThrow(
      '未知模板：nope（可选：default, demo）',
    );
  });
});
