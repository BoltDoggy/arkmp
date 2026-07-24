/**
 * T52 —— 完整 demo 工程 build 快照
 *
 * 构造一个多页面 + 自定义组件 + tabBar 的完整 ArkMP 工程，
 * 调用 buildProject 全量编译，断言产物结构与关键内容。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { buildProject } from '@arkmp/compiler';

function createDemoProject(): string {
  const root = mkdtempSync(join(tmpdir(), 'arkmp-e2e-'));
  const put = (rel: string, content: string): void => {
    const target = join(root, rel);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
  };

  put('src/app.ets', `// 应用入口\n`);

  put(
    'src/pages/index/Index.ets',
    [
      '@Entry({ title: "首页" })',
      '@Component',
      'struct Index {',
      '  @State count: number = 0;',
      '',
      '  build() {',
      '    Column({ space: 12 }) {',
      '      Text(`点击：${this.count}`).fontSize(20)',
      '      Button("加一").onClick(() => { this.count++; })',
      '      Counter({ count: this.count })',
      '    }',
      '    .width("100%")',
      '  }',
      '}',
      '',
    ].join('\n'),
  );

  put(
    'src/pages/mine/Mine.ets',
    [
      '@Entry({ title: "我的" })',
      '@Component',
      'struct Mine {',
      '  build() {',
      '    Column() {',
      '      Text("个人中心")',
      '    }',
      '  }',
      '}',
      '',
    ].join('\n'),
  );

  put(
    'src/components/Counter.ets',
    [
      '@Component',
      'struct Counter {',
      '  count: number = 0;',
      '',
      '  build() {',
      '    Row() {',
      '      Text(`计数器：${this.count}`)',
      '    }',
      '  }',
      '}',
      '',
    ].join('\n'),
  );

  put('src/resources/media/icon.png', Buffer.from([0x89, 0x50, 0x4e, 0x47]));

  return root;
}

describe('T52: 完整 demo 工程 build', () => {
  let root: string;

  beforeEach(() => {
    root = createDemoProject();
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('全量编译产物结构完整', async () => {
    const result = await buildProject({
      rootDir: root,
      appId: 'wxtest1234567890',
      appName: 'demo-app',
      compile: { unitRatio: 2, sourcemap: false },
      window: { navigationBarTitleText: 'Demo' },
      tabBar: { pages: [{ name: 'Index', text: '首页' }, { name: 'Mine', text: '我的' }] },
    });

    expect(result.hasErrors).toBe(false);
    expect(result.files).toBeGreaterThan(8);

    // app.json 存在且包含 pages 列表
    const appJson = JSON.parse(readFileSync(join(root, 'dist', 'app.json'), 'utf8'));
    expect(appJson.pages).toContain('pages/index/index');
    expect(appJson.pages).toContain('pages/mine/mine');
    expect(appJson.window.navigationBarTitleText).toBe('Demo');
    expect(appJson.tabBar.list).toHaveLength(2);

    // project.config.json 存在
    const projConfig = JSON.parse(readFileSync(join(root, 'dist', 'project.config.json'), 'utf8'));
    expect(projConfig.appid).toBe('wxtest1234567890');

    // 页面产物四件套
    for (const ext of ['wxml', 'wxss', 'js', 'json']) {
      expect(existsSync(join(root, 'dist', 'pages', 'index', `index.${ext}`))).toBe(true);
      expect(existsSync(join(root, 'dist', 'pages', 'mine', `mine.${ext}`))).toBe(true);
    }

    // 自定义组件产物
    expect(existsSync(join(root, 'dist', 'components', 'counter.wxml'))).toBe(true);
    expect(existsSync(join(root, 'dist', 'components', 'counter.js'))).toBe(true);

    // index 页面引用 Counter 组件
    const indexJson = JSON.parse(
      readFileSync(join(root, 'dist', 'pages', 'index', 'index.json'), 'utf8'),
    );
    expect(indexJson.usingComponents).toBeDefined();
    expect(Object.keys(indexJson.usingComponents)).toContain('counter');

    // runtime 单文件注入
    expect(existsSync(join(root, 'dist', 'arkmp', 'runtime.js'))).toBe(true);

    // 资源拷贝
    expect(existsSync(join(root, 'dist', 'assets', 'icon.png'))).toBe(true);
  });

  it('index 页面 WXML 包含点击绑定和文本插值', async () => {
    await buildProject({ rootDir: root });

    const wxml = readFileSync(join(root, 'dist', 'pages', 'index', 'index.wxml'), 'utf8');
    // 文本绑定
    expect(wxml).toContain('{{count}}');
    // 事件绑定（__nX_click 形式）
    expect(wxml).toMatch(/bindtap="__n\d+_click"/);
    // 自定义组件标签
    expect(wxml).toMatch(/<counter/);
  });

  it('index 页面 JS 调用 createPage 并含 __set 桥接', async () => {
    await buildProject({ rootDir: root });

    const js = readFileSync(join(root, 'dist', 'pages', 'index', 'index.js'), 'utf8');
    expect(js).toContain("require(");
    expect(js).toContain('createPage');
    expect(js).toContain('state:');
    expect(js).toContain('__set(');
  });

  it('runtime require 路径已改写为相对路径', async () => {
    await buildProject({ rootDir: root });

    const js = readFileSync(join(root, 'dist', 'pages', 'index', 'index.js'), 'utf8');
    // 不应保留裸 require('@arkmp/runtime')
    expect(js).not.toContain("require('@arkmp/runtime')");
    // 应有相对路径
    expect(js).toMatch(/require\(['"].*runtime\.js['"]\)/);
  });
});
