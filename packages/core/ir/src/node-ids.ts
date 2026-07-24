import type { ComponentModel, UIChildNode, UINode } from './types';

/**
 * 按深度优先（先序）为 UI 树中每个节点分配稳定 id：`n0`, `n1`…。
 * 控制节点（if / foreach）同样参与编号。id 用于样式类名与事件名生成
 * （02 篇③④，如 `__n7_click`）。相同结构的树多次分配结果一致。
 *
 * 就地写入各节点的 `id` 字段并返回整棵树。
 */
export function assignNodeIds(tree: UINode): UINode {
  let next = 0;
  const visit = (node: UIChildNode): void => {
    node.id = `n${next}`;
    next += 1;
    for (const child of node.children) {
      visit(child);
    }
    if (node.type === 'if') {
      for (const child of node.elseChildren) {
        visit(child);
      }
    }
  };
  visit(tree);
  return tree;
}

/** 深度优先遍历 ComponentModel 的全部 UI 树（buildTree + builders）。 */
export function walkUIChildren(
  node: UIChildNode,
  visit: (node: UIChildNode) => void,
): void {
  visit(node);
  for (const child of node.children) {
    walkUIChildren(child, visit);
  }
  if (node.type === 'if') {
    for (const child of node.elseChildren) {
      walkUIChildren(child, visit);
    }
  }
}

/** 遍历 ComponentModel 中的全部 UI 树。 */
export function walkModelTrees(
  model: ComponentModel,
  visit: (node: UIChildNode) => void,
): void {
  walkUIChildren(model.buildTree, visit);
  for (const tree of Object.values(model.builders)) {
    walkUIChildren(tree, visit);
  }
}
