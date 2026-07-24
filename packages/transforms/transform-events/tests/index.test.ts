import { describe, expect, it } from 'vitest';
import type { ComponentModel, UINode } from '@arkmp/ir';
import { deriveMethodName, shortEventName, transformEvents } from '../src/index';

function node(partial: Partial<UINode> & Pick<UINode, 'component'>): UINode {
  return { type: 'component', params: [], children: [], styleCalls: [], eventCalls: [], ...partial };
}

function model(buildTree: UINode, builders: Record<string, UINode> = {}): ComponentModel {
  return {
    name: 'Index',
    isEntry: true,
    states: [],
    props: [],
    lifecycle: {},
    methods: [],
    buildTree,
    builders,
  };
}

describe('shortEventName / deriveMethodName', () => {
  it('派生短事件名与方法名', () => {
    expect(shortEventName('onClick')).toBe('click');
    expect(shortEventName('onReachEnd')).toBe('reachEnd');
    expect(shortEventName('scroll')).toBe('scroll');
    expect(deriveMethodName('n7', 'onClick')).toBe('__n7_click');
  });
});

describe('transformEvents', () => {
  it('单节点单事件：事件表 + 方法体抽取', () => {
    const m = model(
      node({
        id: 'n0',
        component: 'Column',
        children: [
          node({ id: 'n1', component: 'Button', eventCalls: [{ name: 'onClick', body: 'this.submit();' }] }),
        ],
      }),
    );
    const { bindings, methods } = transformEvents(m);
    expect(bindings).toEqual([{ nodeId: 'n1', event: 'onClick', name: 'click', method: '__n1_click' }]);
    expect(methods).toEqual({ __n1_click: 'this.submit();' });
  });

  it('多事件 / 多节点 / 控制节点嵌套', () => {
    const m = model(
      node({
        id: 'n0',
        component: 'Column',
        children: [
          {
            type: 'if',
            id: 'n1',
            condition: { kind: 'binding', path: 'ok' },
            children: [
              node({
                id: 'n2',
                component: 'Button',
                eventCalls: [
                  { name: 'onClick', body: 'this.a();' },
                  { name: 'onTouch', body: 'this.b();' },
                ],
              }),
            ],
            elseChildren: [
              {
                type: 'foreach',
                id: 'n3',
                items: { kind: 'binding', path: 'list' },
                itemName: 'item',
                children: [
                  node({ id: 'n4', component: 'Text', eventCalls: [{ name: 'onClick', body: 'this.pick(item);' }] }),
                ],
              },
            ],
          },
        ],
      }),
    );
    const { bindings, methods } = transformEvents(m);
    expect(bindings.map((b) => b.method)).toEqual(['__n2_click', '__n2_touch', '__n4_click']);
    expect(Object.keys(methods)).toEqual(['__n2_click', '__n2_touch', '__n4_click']);
    expect(methods.__n4_click).toBe('this.pick(item);');
  });

  it('@Builder 树中的事件一并收集', () => {
    const m = model(
      node({ id: 'n0', component: 'Column' }),
      { footer: node({ id: 'n5', component: 'Button', eventCalls: [{ name: 'onClick', body: 'this.more();' }] }) },
    );
    const { bindings, methods } = transformEvents(m);
    expect(bindings).toHaveLength(1);
    expect(bindings[0].method).toBe('__n5_click');
    expect(methods.__n5_click).toBe('this.more();');
  });

  it('缺失节点 id 时回退 id 确定性分配，且结果可重复', () => {
    const build = (): ComponentModel =>
      model(
        node({
          component: 'Column',
          children: [
            node({ component: 'Button', eventCalls: [{ name: 'onClick', body: 'this.a();' }] }),
            node({ id: 'n9', component: 'Button', eventCalls: [{ name: 'onClick', body: 'this.b();' }] }),
          ],
        }),
      );
    const first = transformEvents(build());
    const second = transformEvents(build());
    expect(first).toEqual(second);
    expect(first.bindings.map((b) => b.method)).toEqual(['__x1_click', '__n9_click']);
  });

  it('无事件时输出空表', () => {
    const { bindings, methods } = transformEvents(model(node({ id: 'n0', component: 'Column' })));
    expect(bindings).toEqual([]);
    expect(methods).toEqual({});
  });
});
