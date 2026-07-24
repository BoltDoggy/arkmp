import { createRequire } from 'node:module';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WatchEventSource, WatchEventType } from '@arkmp/watcher';
import { compileProject, createWatchSession, CompilerSession } from '../src/index';

// ── 多文件工程 fixture（app.ets + 2 页面 + 1 组件 + 1 张假图片）──

const APP_ETS = `// 应用入口（最小特判：不解析内容，生成 App() 形态）
`;

const INDEX_ETS = `@Entry({ title: '首页' })
@Component
struct Index {
  @State count: number = 0;

  build() {
    Column({ space: 12 }) {
      UserCard({ name: 'ark' })
      Text(\`count=\${this.count}\`).fontSize(20)
    }
  }
}
`;

const DETAIL_ETS = `@Entry
@Component
struct Detail {
  build() {
    Column() {
      Text('详情页')
    }
  }
}
`;

const USER_CARD_ETS_V1 = `@Component
struct UserCard {
  name: string = '';

  build() {
    Row() {
      Text(this.name)
    }
  }
}
`;

const USER_CARD_ETS_V2 = `@Component
struct UserCard {
  name: string = '';

  build() {
    Column() {
      Text(this.name).fontSize(14)
    }
  }
}
`;

/** 把 fixture 工程写入临时目录，返回工程根。 */
function createProject(): string {
  const root = mkdtempSync(join(tmpdir(), 'arkmp-project-'));
  const put = (rel: string, content: string | Buffer): void => {
    const target = join(root, rel);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
  };
  put('src/app.ets', APP_ETS);
  put('src/pages/index/Index.ets', INDEX_ETS);
  put('src/pages/detail/Detail.ets', DETAIL_ETS);
  put('src/components/UserCard.ets', USER_CARD_ETS_V1);
  put('src/resources/media/logo.png', Buffer.from([0x89, 0x50, 0x4e, 0x47])); // 假图片
  return root;
}

/** 读取产物目录为 相对路径 → 内容（文本；二进制读为 latin1 保证可比）。 */
function readDist(root: string): Record<string, string> {
  const dist = join(root, 'dist');
  const result: Record<string, string> = {};
  const walk = (dir: string, rel: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const relPath = rel === '' ? entry : `${rel}/${entry}`;
      if (statSync(full).isDirectory()) walk(full, relPath);
      else result[relPath] = readFileSync(full, 'latin1');
    }
  };
  walk(dist, '');
  return result;
}

/** 可编程触发的假事件源。 */
class FakeSource implements WatchEventSource {
  private listener: ((type: WatchEventType, path: string) => void) | undefined;
  onEvent(listener: (type: WatchEventType, path: string) => void): void {
    this.listener = listener;
  }
  emit(type: WatchEventType, path: string): void {
    this.listener?.(type, path);
  }
  async close(): Promise<void> {}
}

let root!: string;
afterEach(() => {
  if (root !== undefined) rmSync(root, { recursive: true, force: true });
});

describe('compileProject：多文件工程全量构建', () => {
  beforeEach(() => {
    root = createProject();
  });

  it('产物目录结构完整且无诊断', async () => {
    const result = await compileProject({ rootDir: root, appId: 'wx-test', appName: '测试应用' });
    expect(result.diagnostics).toEqual([]);
    expect(result.hasErrors).toBe(false);

    const dist = readDist(root);
    expect(Object.keys(dist).sort()).toEqual([
      'app.js',
      'app.json',
      'app.wxss',
      'arkmp/runtime.js',
      'assets/logo.png',
      'components/user-card.js',
      'components/user-card.json',
      'components/user-card.wxml',
      'components/user-card.wxss',
      'pages/detail/detail.js',
      'pages/detail/detail.json',
      'pages/detail/detail.wxml',
      'pages/detail/detail.wxss',
      'pages/index/index.js',
      'pages/index/index.json',
      'pages/index/index.wxml',
      'pages/index/index.wxss',
      'project.config.json',
    ]);
    expect(result.files).toBe(Object.keys(dist).length);
    expect(result.rebuilt).toEqual([
      'components/UserCard.ets',
      'pages/detail/Detail.ets',
      'pages/index/Index.ets',
    ]);
  });

  it('app.json 含 pages 列表与 window/tabBar/permission 合并', async () => {
    await compileProject({
      rootDir: root,
      window: { navigationBarBackgroundColor: '#ffffff' },
      tabBar: { pages: [{ name: 'Index', text: '首页', icon: 'assets/logo.png' }] },
      permission: { 'scope.userLocation': { desc: '用于展示附近门店' } },
    });
    const appJson = JSON.parse(readFileSync(join(root, 'dist/app.json'), 'utf8')) as Record<string, unknown>;
    expect(appJson.pages).toEqual(['pages/detail/detail', 'pages/index/index']);
    expect(appJson.window).toEqual({ navigationBarBackgroundColor: '#ffffff' });
    expect(appJson.tabBar).toEqual({
      list: [{ pagePath: 'pages/index/index', text: '首页', iconPath: 'assets/logo.png' }],
    });
    expect(appJson.permission).toEqual({ 'scope.userLocation': { desc: '用于展示附近门店' } });
  });

  it('页面 json 补 usingComponents；app.js 为 App() 形态', async () => {
    await compileProject({ rootDir: root });
    const indexJson = JSON.parse(readFileSync(join(root, 'dist/pages/index/index.json'), 'utf8')) as Record<
      string,
      unknown
    >;
    expect(indexJson.usingComponents).toEqual({ 'user-card': '/components/user-card' });
    // 未引用组件的页面不带 usingComponents
    const detailJson = JSON.parse(readFileSync(join(root, 'dist/pages/detail/detail.json'), 'utf8')) as Record<
      string,
      unknown
    >;
    expect(detailJson.usingComponents).toBeUndefined();

    expect(readFileSync(join(root, 'dist/app.js'), 'utf8')).toContain('App({});');
  });

  it('runtime 拷贝为 arkmp/runtime.js，产物 js 的 require 改写为相对路径', async () => {
    await compileProject({ rootDir: root });

    const require = createRequire(import.meta.url);
    const runtimeEntry = require.resolve('@arkmp/runtime');
    const sourceRuntime = readFileSync(join(dirname(runtimeEntry), 'runtime.js'), 'latin1');
    expect(readFileSync(join(root, 'dist/arkmp/runtime.js'), 'latin1')).toBe(sourceRuntime);

    const indexJs = readFileSync(join(root, 'dist/pages/index/index.js'), 'utf8');
    expect(indexJs).toContain("require('../../arkmp/runtime.js')");
    expect(indexJs).not.toContain("require('@arkmp/runtime')");
    const cardJs = readFileSync(join(root, 'dist/components/user-card.js'), 'utf8');
    expect(cardJs).toContain("require('../arkmp/runtime.js')");
  });

  it('产物内容全量快照（runtime.js 除外）', async () => {
    await compileProject({ rootDir: root });
    const dist = readDist(root);
    const snapshot = Object.keys(dist)
      .filter((p) => p !== 'arkmp/runtime.js' && p !== 'assets/logo.png')
      .sort()
      .map((p) => `=== ${p} ===\n${dist[p]}`)
      .join('\n');
    expect(snapshot).toMatchSnapshot();
  });
});

describe('CompilerSession：增量构建', () => {
  beforeEach(() => {
    root = createProject();
  });

  it('改叶子组件 → 只重编该组件与引用它的页面', async () => {
    const session = new CompilerSession({ rootDir: root });
    await session.build();

    writeFileSync(join(root, 'src/components/UserCard.ets'), USER_CARD_ETS_V2);
    const result = await session.build(['components/UserCard.ets']);

    expect(result.rebuilt).toEqual(['components/UserCard.ets', 'pages/index/Index.ets']);
    // 组件新产物已落盘（fontSize(14) → 28rpx）
    expect(readFileSync(join(root, 'dist/components/user-card.wxss'), 'utf8')).toContain('28rpx');
    // 引用方页面产物也被重写（written 含组件与 index 页面，不含 detail 页面）
    expect(result.written).toContain('components/user-card.wxml');
    expect(result.written).toContain('pages/index/index.js');
    expect(result.written.filter((p) => p.startsWith('pages/detail/'))).toEqual([]);
  });

  it('改页面 → 不重建兄弟页面与组件', async () => {
    const session = new CompilerSession({ rootDir: root });
    await session.build();

    writeFileSync(
      join(root, 'src/pages/detail/Detail.ets'),
      DETAIL_ETS.replace('详情页', '详情页 v2'),
    );
    const result = await session.build(['pages/detail/Detail.ets']);

    expect(result.rebuilt).toEqual(['pages/detail/Detail.ets']);
    expect(result.written.filter((p) => p.startsWith('pages/index/'))).toEqual([]);
    expect(result.written.filter((p) => p.startsWith('components/'))).toEqual([]);
  });

  it('touch 但内容未变 → 不重编', async () => {
    const session = new CompilerSession({ rootDir: root });
    await session.build();

    const result = await session.build(['pages/detail/Detail.ets']);
    expect(result.rebuilt).toEqual([]);
    expect(result.written.filter((p) => p.startsWith('pages/'))).toEqual([]);
  });

  it('删除页面 → 清理其产物并更新 app.json pages', async () => {
    const session = new CompilerSession({ rootDir: root });
    await session.build();

    rmSync(join(root, 'src/pages/detail'), { recursive: true });
    const result = await session.build(['pages/detail/Detail.ets']);

    expect(existsSync(join(root, 'dist/pages/detail/detail.wxml'))).toBe(false);
    const appJson = JSON.parse(readFileSync(join(root, 'dist/app.json'), 'utf8')) as Record<string, unknown>;
    expect(appJson.pages).toEqual(['pages/index/index']);
    expect(result.rebuilt).toEqual([]);
  });
});

describe('createWatchSession', () => {
  beforeEach(() => {
    root = createProject();
  });

  it('首次全量 + 文件变更经去抖后触发增量构建', async () => {
    const source = new FakeSource();
    const session = createWatchSession({
      rootDir: root,
      watch: { debounceMs: 5, source },
    });

    const built: string[][] = [];
    const first = await session.start((result) => built.push(result.rebuilt));
    expect(first.rebuilt).toHaveLength(3);

    writeFileSync(join(root, 'src/components/UserCard.ets'), USER_CARD_ETS_V2);
    source.emit('change', 'components/UserCard.ets');

    await vi.waitFor(
      () => {
        expect(built).toEqual([['components/UserCard.ets', 'pages/index/Index.ets']]);
      },
      { timeout: 3000, interval: 20 },
    );
    await session.close();
  }, 10000);
});
