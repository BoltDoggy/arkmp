import { analyze, classifyExpression } from '@arkmp/analyzer';
import type { Diagnostic } from '@arkmp/diagnostics';
import type { ComponentModel, IfNode, UINode } from '@arkmp/ir';
import { CHAIN_MARKER, parse } from '@arkmp/parser';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

// analyzer 本地定义的续链标记必须与 parser 的 CHAIN_MARKER 一致
// （端到端一致性同时由「尾随子节点块之后的链式调用挂回根节点」用例覆盖）
it('续链标记与 @arkmp/parser 一致', () => {
  expect(CHAIN_MARKER).toBe('__arkmp_chain');
  const { sourceFile } = parse('Column() {\n}\n.width(1)\n');
  expect(sourceFile.getText(sourceFile)).toContain(`${CHAIN_MARKER}.width(1)`);
});

/** 走完整 parse + analyze，合并两阶段诊断。 */
function analyzeSource(source: string): { model: ComponentModel; diagnostics: Diagnostic[] } {
  const parsed = parse(source, 'pages/Index.ets');
  const result = analyze(parsed.sourceFile, 'pages/Index.ets');
  return { model: result.model, diagnostics: [...parsed.diagnostics, ...result.diagnostics] };
}

function ets(body: string): string {
  return `@Entry\n@Component\nstruct Index {\n${body}\n}\n`;
}

describe('装饰器白名单', () => {
  it('白名单装饰器全部通过，无诊断', () => {
    const { diagnostics } = analyzeSource(
      ets(`  @State a: number = 0;
  @Prop b: string;
  @Link c: boolean;
  @State @Watch('onAChange') d: number = 1;
  @Builder content() { Text('x') }
  @Styles card() {}
  @Extend(Text) big() {}
  onAChange() {}
  build() { Column() { Text('a') } }`),
    );
    expect(diagnostics).toHaveLength(0);
  });

  it('未知装饰器报 E1101 并带位置', () => {
    const { diagnostics } = analyzeSource(
      '@Component\nstruct Index {\n  @Observed count: number = 0;\n  build() { Column() {} }\n}\n',
    );
    const d = diagnostics.find((x) => x.code === 'E1101');
    expect(d).toBeDefined();
    expect(d?.level).toBe('error');
    expect(d?.message).toContain('@Observed');
    expect(d?.file).toBe('pages/Index.ets');
    expect(d?.line).toBe(3);
  });
});

describe('字段与方法提取', () => {
  it('提取 @State/@Prop/@Link/普通成员与 @Watch 回调', () => {
    const { model, diagnostics } = analyzeSource(
      ets(`  @State count: number = 0;
  @State @Watch('onCountChange') total: number = 10;
  @Prop title: string;
  @Link visible: boolean;
  extra: string = 'x';
  build() { Column() { Text('a') } }`),
    );
    expect(diagnostics).toHaveLength(0);
    expect(model.states).toEqual([
      { name: 'count', type: 'number', initialValue: { kind: 'static', value: 0 }, watch: undefined },
      { name: 'total', type: 'number', initialValue: { kind: 'static', value: 10 }, watch: 'onCountChange' },
    ]);
    expect(model.props).toEqual([
      { name: 'title', type: 'string', kind: 'prop', initialValue: undefined },
      { name: 'visible', type: 'boolean', kind: 'link', initialValue: undefined },
      { name: 'extra', type: 'string', kind: 'plain', initialValue: { kind: 'static', value: 'x' } },
    ]);
  });

  it('提取生命周期钩子与普通方法（body 为源码文本）', () => {
    const { model } = analyzeSource(
      ets(`  aboutToAppear() { this.load(); }
  onPageShow() { this.refresh(); }
  submit(id: number) { this.post(id); }
  build() { Column() { Text('a') } }`),
    );
    expect(model.lifecycle).toEqual({ aboutToAppear: 'this.load();', onPageShow: 'this.refresh();' });
    expect(model.methods).toEqual([{ name: 'submit', params: ['id'], body: 'this.post(id);' }]);
  });

  it('提取 onDidBuild 生命周期钩子', () => {
    const { model } = analyzeSource(
      ets(`  onDidBuild() { this.measure(); }
  build() { Column() { Text('a') } }`),
    );
    expect(model.lifecycle).toEqual({ onDidBuild: 'this.measure();' });
  });

  it('@Entry({...}) 静态参数提取为 entryOptions', () => {
    const { model } = analyzeSource(
      `@Entry({ title: '首页', pullRefresh: true, cacheSize: -1 })\n@Component\nstruct Index {\n  build() { Column() {} }\n}\n`,
    );
    expect(model.isEntry).toBe(true);
    expect(model.entryOptions).toEqual({ title: '首页', pullRefresh: true, cacheSize: -1 });
  });

  it('@Entry 无参数或非字面量参数时无 entryOptions', () => {
    const noArgs = analyzeSource(ets(`  build() { Column() {} }`));
    expect(noArgs.model.entryOptions).toBeUndefined();
    const dynamic = analyzeSource(
      `@Entry({ title: someConst })\n@Component\nstruct Index {\n  build() { Column() {} }\n}\n`,
    );
    expect(dynamic.model.entryOptions).toBeUndefined();
  });
});

describe('build() → UINode 树', () => {
  it('嵌套组件、构造参数与链式样式/事件分类', () => {
    const { model, diagnostics } = analyzeSource(
      ets(`  @State count: number = 0;
  build() {
    Column({ space: 12 }) {
      Text(\`count=\${this.count}\`).fontSize(20)
      Button('点我').onClick(() => { this.count++; })
    }
  }`),
    );
    expect(diagnostics).toHaveLength(0);
    const root = model.buildTree;
    expect(root.component).toBe('Column');
    expect(root.params).toEqual([{ kind: 'static', value: { space: 12 } }]);
    expect(root.children).toHaveLength(2);

    const text = root.children[0] as UINode;
    expect(text.component).toBe('Text');
    expect(text.params).toEqual([{ kind: 'binding', path: 'count', template: 'count=${0}' }]);
    expect(text.styleCalls).toEqual([{ name: 'fontSize', args: [{ kind: 'static', value: 20 }] }]);

    const button = root.children[1] as UINode;
    expect(button.params).toEqual([{ kind: 'static', value: '点我' }]);
    expect(button.eventCalls).toEqual([{ name: 'onClick', body: 'this.count++;' }]);
  });

  it('尾随子节点块之后的链式调用挂回根节点', () => {
    const { model, diagnostics } = analyzeSource(
      ets(`  build() {
    Column({ space: 12 }) {
      Text('a')
    }
    .width('100%')
    .justifyContent(FlexAlign.Center)
  }`),
    );
    expect(diagnostics).toHaveLength(0);
    expect(model.buildTree.styleCalls).toEqual([
      { name: 'width', args: [{ kind: 'static', value: '100%' }] },
      { name: 'justifyContent', args: [{ kind: 'static', value: 'FlexAlign.Center' }] },
    ]);
  });

  it('节点 id 按先序分配（n0, n1…）', () => {
    const { model } = analyzeSource(ets(`  build() { Column() { Text('a') Text('b') } }`));
    expect(model.buildTree.id).toBe('n0');
    expect((model.buildTree.children[0] as UINode).id).toBe('n1');
    expect((model.buildTree.children[1] as UINode).id).toBe('n2');
  });
});

describe('控制流归一', () => {
  it('if / else if / else → IfNode（else-if 嵌套在 elseChildren）', () => {
    const { model, diagnostics } = analyzeSource(
      ets(`  @State tab: number = 0;
  build() {
    Column() {
      if (this.tab === 0) {
        Text('首页')
      } else if (this.tab === 1) {
        Text('我的')
      } else {
        Text('其他')
      }
    }
  }`),
    );
    expect(diagnostics).toHaveLength(0);
    const ifNode = model.buildTree.children[0] as IfNode;
    expect(ifNode.type).toBe('if');
    expect(ifNode.condition).toEqual({ kind: 'binding', path: 'tab', template: '${0} === 0' });
    expect((ifNode.children[0] as UINode).params).toEqual([{ kind: 'static', value: '首页' }]);
    const elseIf = ifNode.elseChildren[0] as IfNode;
    expect(elseIf.type).toBe('if');
    expect(elseIf.condition).toEqual({ kind: 'binding', path: 'tab', template: '${0} === 1' });
    expect((elseIf.elseChildren[0] as UINode).params).toEqual([{ kind: 'static', value: '其他' }]);
  });

  it('ForEach(arr, (item, index) => ...) → ForEachNode', () => {
    const { model, diagnostics } = analyzeSource(
      ets(`  @State list: string[] = ['a', 'b'];
  build() {
    Column() {
      ForEach(this.list, (item: string, index: number) => {
        Text(\`\${index}: \${item}\`)
      })
    }
  }`),
    );
    expect(diagnostics).toHaveLength(0);
    const forEach = model.buildTree.children[0];
    expect(forEach.type).toBe('foreach');
    if (forEach.type !== 'foreach') throw new Error('unreachable');
    expect(forEach.items).toEqual({ kind: 'binding', path: 'list' });
    expect(forEach.itemName).toBe('item');
    expect(forEach.indexName).toBe('index');
    expect(forEach.children).toHaveLength(1);
  });
});

describe('表达式分类', () => {
  it('纯静态：数字/字符串/布尔/常量运算', () => {
    const { model } = analyzeSource(
      ets(`  build() {
    Column() {
      Text('a').fontSize(20).opacity(0.5).width(100 * 2)
    }
  }`),
    );
    const text = model.buildTree.children[0] as UINode;
    expect(text.styleCalls).toEqual([
      { name: 'fontSize', args: [{ kind: 'static', value: 20 }] },
      { name: 'opacity', args: [{ kind: 'static', value: 0.5 }] },
      { name: 'width', args: [{ kind: 'static', value: 200 }] },
    ]);
  });

  it('绑定：this.xxx 路径与模板字符串插值', () => {
    const { model } = analyzeSource(
      ets(`  @State form: { id: number } = { id: 1 };
  build() {
    Column() {
      Text(this.form.id)
      Button(\`提交 \${this.form.id}\`)
    }
  }`),
    );
    const [text, button] = model.buildTree.children as [UINode, UINode];
    expect(text.params).toEqual([{ kind: 'binding', path: 'form.id' }]);
    expect(button.params).toEqual([{ kind: 'binding', path: 'form.id', template: '提交 ${0}' }]);
  });

  it('classifyExpression 复合表达式取首个路径并生成模板', () => {
    const { sourceFile } = parse('const x = this.count + 1;');
    const decl = sourceFile.statements[0];
    if (!ts.isVariableStatement(decl)) throw new Error('unreachable');
    const init = decl.declarationList.declarations[0].initializer;
    expect(classifyExpression(init!, sourceFile)).toEqual({
      kind: 'binding',
      path: 'count',
      template: '${0} + 1',
    });
  });
});

describe('@Builder 提取', () => {
  it('@Builder 方法 → builders 记录', () => {
    const { model, diagnostics } = analyzeSource(
      ets(`  @Builder footer() {
    Row() {
      Text('底部')
    }
    .height(48)
  }
  build() {
    Column() {
      Text('内容')
    }
  }`),
    );
    expect(diagnostics).toHaveLength(0);
    expect(Object.keys(model.builders)).toEqual(['footer']);
    const footer = model.builders.footer;
    expect(footer.component).toBe('Row');
    expect((footer.children[0] as UINode).params).toEqual([{ kind: 'static', value: '底部' }]);
    expect(footer.styleCalls).toEqual([{ name: 'height', args: [{ kind: 'static', value: 48 }] }]);
  });
});

describe('README 示例完整分析', () => {
  const README_EXAMPLE = `@Entry
@Component
struct Index {
  @State count: number = 0;

  build() {
    Column({ space: 12 }) {
      Text(\`点击次数：\${this.count}\`).fontSize(20)
      Button('点我 +1').onClick(() => { this.count++; })
    }
    .width('100%')
    .justifyContent(FlexAlign.Center)
  }
}
`;

  it('analyze 出合理的 model 且无诊断', () => {
    const { model, diagnostics } = analyzeSource(README_EXAMPLE);
    expect(diagnostics).toHaveLength(0);
    expect(model.name).toBe('Index');
    expect(model.isEntry).toBe(true);
    expect(model.states).toEqual([
      { name: 'count', type: 'number', initialValue: { kind: 'static', value: 0 }, watch: undefined },
    ]);

    const root = model.buildTree;
    expect(root.id).toBe('n0');
    expect(root.component).toBe('Column');
    expect(root.params).toEqual([{ kind: 'static', value: { space: 12 } }]);
    expect(root.styleCalls).toEqual([
      { name: 'width', args: [{ kind: 'static', value: '100%' }] },
      { name: 'justifyContent', args: [{ kind: 'static', value: 'FlexAlign.Center' }] },
    ]);

    const [text, button] = root.children as [UINode, UINode];
    expect(text.id).toBe('n1');
    expect(text.component).toBe('Text');
    expect(text.params).toEqual([{ kind: 'binding', path: 'count', template: '点击次数：${0}' }]);
    expect(text.styleCalls).toEqual([{ name: 'fontSize', args: [{ kind: 'static', value: 20 }] }]);
    expect(button.id).toBe('n2');
    expect(button.component).toBe('Button');
    expect(button.eventCalls).toEqual([{ name: 'onClick', body: 'this.count++;' }]);
  });
});
