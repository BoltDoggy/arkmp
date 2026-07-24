import { describe, expect, it } from 'vitest';
import { DepGraph } from '../src/index';

describe('DepGraph', () => {
  it('dependentsOf 返回传递闭包（级联集合）', () => {
    const g = new DepGraph();
    // Index 依赖 UserCard；UserCard 依赖 Avatar；Detail 依赖 UserCard
    g.addFile('pages/index/Index.ets', ['components/UserCard.ets']);
    g.addFile('pages/detail/Detail.ets', ['components/UserCard.ets']);
    g.addFile('components/UserCard.ets', ['components/Avatar.ets']);
    g.addFile('components/Avatar.ets');

    expect(g.dependentsOf('components/Avatar.ets')).toEqual([
      'components/UserCard.ets',
      'pages/detail/Detail.ets',
      'pages/index/Index.ets',
    ]);
    expect(g.dependentsOf('components/UserCard.ets')).toEqual([
      'pages/detail/Detail.ets',
      'pages/index/Index.ets',
    ]);
    expect(g.dependentsOf('pages/index/Index.ets')).toEqual([]);
  });

  it('dependenciesOf 返回传递闭包，directDependenciesOf 只给直接依赖', () => {
    const g = new DepGraph();
    g.addFile('a.ets', ['b.ets']);
    g.addFile('b.ets', ['c.ets']);
    g.addFile('c.ets');

    expect(g.directDependenciesOf('a.ets')).toEqual(['b.ets']);
    expect(g.dependenciesOf('a.ets')).toEqual(['b.ets', 'c.ets']);
    expect(g.dependenciesOf('c.ets')).toEqual([]);
    expect(g.dependenciesOf('missing.ets')).toEqual([]);
  });

  it('环形引用不爆栈，且闭包不含查询文件自身', () => {
    const g = new DepGraph();
    g.addFile('a.ets', ['b.ets']);
    g.addFile('b.ets', ['c.ets']);
    g.addFile('c.ets', ['a.ets']); // 成环

    expect(g.dependentsOf('a.ets')).toEqual(['b.ets', 'c.ets']);
    expect(g.dependenciesOf('a.ets')).toEqual(['b.ets', 'c.ets']);
    // 自引用边被忽略
    g.addFile('self.ets', ['self.ets']);
    expect(g.dependenciesOf('self.ets')).toEqual([]);
  });

  it('addFile 重复调用整体替换依赖边（正反向同步更新）', () => {
    const g = new DepGraph();
    g.addFile('a.ets', ['b.ets']);
    expect(g.dependentsOf('b.ets')).toEqual(['a.ets']);

    g.addFile('a.ets', ['c.ets']);
    expect(g.dependentsOf('b.ets')).toEqual([]);
    expect(g.dependentsOf('c.ets')).toEqual(['a.ets']);
    expect(g.dependenciesOf('a.ets')).toEqual(['c.ets']);
  });

  it('removeFile 移除文件及全部关联边', () => {
    const g = new DepGraph();
    g.addFile('a.ets', ['b.ets']);
    g.addFile('b.ets', ['c.ets']);
    g.addFile('c.ets');

    g.removeFile('b.ets');
    expect(g.has('b.ets')).toBe(false);
    expect(g.dependentsOf('c.ets')).toEqual([]);
    expect(g.dependenciesOf('a.ets')).toEqual([]);
    expect(g.files()).toEqual(['a.ets', 'c.ets']);

    // 移除不存在的文件是 no-op
    g.removeFile('missing.ets');
    expect(g.files()).toEqual(['a.ets', 'c.ets']);
  });
});
