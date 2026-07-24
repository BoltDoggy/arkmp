import type { ComponentModel } from '@arkmp/ir';
import { describe, expect, it } from 'vitest';
import { IncrementalCache } from '../src/index';

/** 构造最小 ComponentModel（缓存不读字段，只需可辨识的对象）。 */
function fakeModel(name: string): ComponentModel {
  return {
    name,
    isEntry: false,
    states: [],
    props: [],
    lifecycle: {},
    methods: [],
    buildTree: { type: 'component', component: 'Column', params: [], children: [], styleCalls: [], eventCalls: [] },
    builders: {},
  };
}

const INDEX = 'pages/index/Index.ets';
const DETAIL = 'pages/detail/Detail.ets';
const USER_CARD = 'components/UserCard.ets';

describe('IncrementalCache', () => {
  it('改叶子组件 → 级联重建引用它的页面', () => {
    const cache = new IncrementalCache();
    cache.update(USER_CARD, 'card-v1', fakeModel('UserCard'));
    cache.update(INDEX, 'index-v1', fakeModel('Index'), [USER_CARD]);
    cache.update(DETAIL, 'detail-v1', fakeModel('Detail'), [USER_CARD]);

    const rebuild = cache.invalidate([USER_CARD]);
    expect(rebuild).toEqual([USER_CARD, DETAIL, INDEX].sort());
    // 失效后缓存已清除
    expect(cache.get(USER_CARD, 'card-v1')).toBeUndefined();
    expect(cache.get(INDEX, 'index-v1')).toBeUndefined();
  });

  it('改页面 → 只重建该页面，不影响兄弟页面与组件', () => {
    const cache = new IncrementalCache();
    cache.update(USER_CARD, 'card-v1', fakeModel('UserCard'));
    cache.update(INDEX, 'index-v1', fakeModel('Index'), [USER_CARD]);
    cache.update(DETAIL, 'detail-v1', fakeModel('Detail'), [USER_CARD]);

    expect(cache.invalidate([INDEX])).toEqual([INDEX]);
    // 兄弟与组件缓存仍在
    expect(cache.get(DETAIL, 'detail-v1')).toEqual(fakeModel('Detail'));
    expect(cache.get(USER_CARD, 'card-v1')).toEqual(fakeModel('UserCard'));
  });

  it('源码哈希未变 → get 命中缓存 model，跳过重编译', () => {
    const cache = new IncrementalCache();
    const model = fakeModel('Index');
    cache.update(INDEX, 'index-v1', model);

    expect(cache.get(INDEX, 'index-v1')).toBe(model); // 同一对象引用
    expect(cache.get(INDEX, 'index-v2')).toBeUndefined(); // 内容变了
    expect(cache.get('missing.ets', 'x')).toBeUndefined(); // 未登记
  });

  it('级联沿多级依赖传递（Avatar → UserCard → 页面）', () => {
    const cache = new IncrementalCache();
    cache.update('components/Avatar.ets', 'a1', fakeModel('Avatar'));
    cache.update(USER_CARD, 'c1', fakeModel('UserCard'), ['components/Avatar.ets']);
    cache.update(INDEX, 'i1', fakeModel('Index'), [USER_CARD]);
    cache.update(DETAIL, 'd1', fakeModel('Detail'));

    expect(cache.invalidate(['components/Avatar.ets'])).toEqual(
      ['components/Avatar.ets', USER_CARD, INDEX].sort(),
    );
  });

  it('remove 清除缓存与图节点；invalidate 包含未知（新增）文件', () => {
    const cache = new IncrementalCache();
    cache.update(USER_CARD, 'c1', fakeModel('UserCard'));
    cache.update(INDEX, 'i1', fakeModel('Index'), [USER_CARD]);

    cache.remove(USER_CARD);
    expect(cache.has(USER_CARD)).toBe(false);
    expect(cache.invalidate([USER_CARD])).toEqual([USER_CARD]); // 不再有引用方

    expect(cache.invalidate(['pages/new/New.ets'])).toEqual(['pages/new/New.ets']);
  });
});
