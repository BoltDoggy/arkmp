import { singleRootNode } from '../src/rules/single-root-node.js';
import { ruleTester } from './helpers.js';

ruleTester.run('single-root-node', singleRootNode, {
  valid: [
    // 单一根节点
    'class A { build() { Column({ space: 12 }); } }',
    // if 分支作为根（表达式语句计数为 0）
    'class A { build() { if (this.ok) { Text("a"); } } }',
    // ForEach 作为根
    'class A { build() { ForEach(this.list, (item) => { Text(item); }); } }',
    // 普通方法不受限
    'class A { render() { Text("a"); Text("b"); } build() { Column(); } }',
  ],
  invalid: [
    // 两个根节点
    {
      code: 'class A { build() { Column(); Text("extra"); } }',
      errors: [{ messageId: 'multiRoot' }],
    },
    // 三个根节点 → 报后两个
    {
      code: 'class A { build() { Row(); Text("a"); Button("b"); } }',
      errors: [{ messageId: 'multiRoot' }, { messageId: 'multiRoot' }],
    },
    // 链式调用仍是一个根
    {
      code: 'class A { build() { Column().width(100); Stack(); } }',
      errors: [{ messageId: 'multiRoot' }],
    },
    // 两个链式根 → 报第二个
    {
      code: 'class A { build() { Column().width(100); Stack().height(50); } }',
      errors: [{ messageId: 'multiRoot' }],
    },
  ],
});
