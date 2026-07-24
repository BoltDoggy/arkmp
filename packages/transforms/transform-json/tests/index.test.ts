import { describe, expect, it } from 'vitest';
import type { ComponentModel } from '@arkmp/ir';
import { transformJson, TRANSFORM_JSON_WARNING_CODES } from '../src/index';

function model(partial: Partial<ComponentModel>): ComponentModel {
  return {
    name: 'Index',
    isEntry: false,
    states: [],
    props: [],
    lifecycle: {},
    methods: [],
    buildTree: { type: 'component', component: 'Column', params: [], children: [], styleCalls: [], eventCalls: [] },
    builders: {},
    ...partial,
  };
}

describe('transformJson', () => {
  it('页面：@Entry({...}) 字段映射为页面 json', () => {
    const { json, diagnostics } = transformJson(
      model({ isEntry: true, entryOptions: { title: '首页', pullRefresh: true } }),
    );
    expect(json).toEqual({ navigationBarTitleText: '首页', enablePullDownRefresh: true });
    expect(diagnostics).toEqual([]);
  });

  it('页面：无 entryOptions 时为空对象', () => {
    const { json, diagnostics } = transformJson(model({ isEntry: true }));
    expect(json).toEqual({});
    expect(diagnostics).toEqual([]);
  });

  it('组件：固定 { component: true }，忽略 entryOptions', () => {
    const { json } = transformJson(model({ isEntry: false }));
    expect(json).toEqual({ component: true });
  });

  it('未识别的 @Entry 配置项：透传并 warning', () => {
    const { json, diagnostics } = transformJson(model({ isEntry: true, entryOptions: { title: 'a', foo: 1 } }));
    expect(json).toEqual({ navigationBarTitleText: 'a', foo: 1 });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].level).toBe('warning');
    expect(diagnostics[0].code).toBe(TRANSFORM_JSON_WARNING_CODES.UNKNOWN_ENTRY_OPTION);
    expect(diagnostics[0].message).toContain('foo');
  });

  it('usingComponents 预留：页面与组件均合并', () => {
    const usingComponents = { 'my-child': '../../components/child/child' };
    expect(transformJson(model({ isEntry: true }), { usingComponents }).json).toEqual({ usingComponents });
    expect(transformJson(model({ isEntry: false }), { usingComponents }).json).toEqual({
      component: true,
      usingComponents,
    });
  });

  it('usingComponents 为空表时不输出该字段', () => {
    expect(transformJson(model({ isEntry: true }), { usingComponents: {} }).json).toEqual({});
  });
});
