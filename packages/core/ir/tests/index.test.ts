import { describe, expect, it } from 'vitest';
import {
  IR_ERROR_CODES,
  assignNodeIds,
  deserializeIR,
  serializeIR,
  validateIR,
  type ComponentModel,
  type UINode,
} from '@arkmp/ir';

function node(partial: Partial<UINode> & { component: string }): UINode {
  return {
    type: 'component',
    params: [],
    children: [],
    styleCalls: [],
    eventCalls: [],
    ...partial,
  };
}

/** 构造一个覆盖各类节点的示例模型：Column > [Text, if > Button, ForEach > Image]。 */
function createModel(): ComponentModel {
  return {
    name: 'Index',
    isEntry: true,
    states: [
      {
        name: 'count',
        type: 'number',
        initialValue: { kind: 'static', value: 0 },
        watch: 'onCountChange',
      },
    ],
    props: [
      { name: 'title', type: 'string', kind: 'prop' },
      { name: 'enabled', type: 'boolean', kind: 'link' },
      { name: 'extra', type: 'string', kind: 'plain' },
    ],
    lifecycle: { aboutToAppear: 'this.loadData();' },
    methods: [{ name: 'onCountChange', params: [], body: 'console.log(this.count);' }],
    buildTree: node({
      component: 'Column',
      params: [{ kind: 'static', value: { space: 12 } }],
      children: [
        node({
          component: 'Text',
          params: [{ kind: 'binding', path: 'count', template: 'count=${0}' }],
          styleCalls: [{ name: 'fontSize', args: [{ kind: 'static', value: 20 }] }],
        }),
        {
          type: 'if',
          condition: { kind: 'binding', path: 'enabled' },
          children: [
            node({
              component: 'Button',
              params: [{ kind: 'static', value: '确定' }],
              eventCalls: [{ name: 'onClick', body: 'this.submit(this.form.id);' }],
            }),
          ],
          elseChildren: [node({ component: 'Text', params: [{ kind: 'static', value: '禁用' }] })],
        },
        {
          type: 'foreach',
          items: { kind: 'binding', path: 'list' },
          itemName: 'item',
          indexName: 'index',
          children: [node({ component: 'Image', params: [{ kind: 'binding', path: 'item.src' }] })],
        },
      ],
    }),
    builders: {
      Footer: node({ component: 'Row', children: [node({ component: 'Text' })] }),
    },
  };
}

describe('assignNodeIds', () => {
  it('按深度优先分配 n0, n1…（含控制节点与 else 分支）', () => {
    const model = createModel();
    const tree = assignNodeIds(model.buildTree);

    expect(tree.id).toBe('n0'); // Column
    const [text, ifNode, forEach] = tree.children;
    expect(text?.id).toBe('n1');
    expect(ifNode?.id).toBe('n2');
    expect(ifNode?.type === 'if' && ifNode.children[0]?.id).toBe('n3'); // Button
    expect(ifNode?.type === 'if' && ifNode.elseChildren[0]?.id).toBe('n4'); // else Text
    expect(forEach?.id).toBe('n5');
    expect(forEach?.type === 'foreach' && forEach.children[0]?.id).toBe('n6'); // Image
  });

  it('相同结构的树分配结果稳定', () => {
    const a = assignNodeIds(createModel().buildTree);
    const b = assignNodeIds(createModel().buildTree);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('分配 id 后可通过 validateIR 校验', () => {
    const model = createModel();
    assignNodeIds(model.buildTree);
    expect(validateIR(model)).toEqual([]);
  });
});

describe('validateIR', () => {
  it('结构完整的模型无诊断', () => {
    expect(validateIR(createModel())).toEqual([]);
  });

  it('组件名为空 → E1001', () => {
    const model = createModel();
    model.name = '';
    const codes = validateIR(model).map((d) => d.code);
    expect(codes).toContain(IR_ERROR_CODES.EMPTY_COMPONENT_NAME);
  });

  it('states/props 重名 → E1002', () => {
    const model = createModel();
    model.states.push({ name: 'title', type: 'number' });
    const codes = validateIR(model).map((d) => d.code);
    expect(codes).toContain(IR_ERROR_CODES.DUPLICATE_FIELD);
  });

  it('节点 id 重复 → E1004', () => {
    const model = createModel();
    assignNodeIds(model.buildTree);
    const text = model.buildTree.children[0];
    if (text) text.id = 'n0';
    const codes = validateIR(model).map((d) => d.code);
    expect(codes).toContain(IR_ERROR_CODES.DUPLICATE_NODE_ID);
  });

  it('组件节点缺少组件名 → E1003', () => {
    const model = createModel();
    model.buildTree.children[0] = node({ component: '' });
    const codes = validateIR(model).map((d) => d.code);
    expect(codes).toContain(IR_ERROR_CODES.INVALID_NODE);
  });

  it('ForEach 缺少迭代变量名 → E1003', () => {
    const model = createModel();
    const forEach = model.buildTree.children[2];
    if (forEach?.type === 'foreach') forEach.itemName = '';
    const codes = validateIR(model).map((d) => d.code);
    expect(codes).toContain(IR_ERROR_CODES.INVALID_NODE);
  });

  it('绑定表达式缺少路径 → E1005', () => {
    const model = createModel();
    model.buildTree.params.push({ kind: 'binding', path: '' });
    const codes = validateIR(model).map((d) => d.code);
    expect(codes).toContain(IR_ERROR_CODES.INVALID_BINDING);
  });
});

describe('serializeIR / deserializeIR', () => {
  it('JSON 往返无损（含 id）', () => {
    const model = createModel();
    assignNodeIds(model.buildTree);
    for (const tree of Object.values(model.builders)) {
      assignNodeIds(tree);
    }
    const restored = deserializeIR(serializeIR(model));
    expect(restored).toEqual(model);
  });
});
