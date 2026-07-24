import type { TSESTree } from '@typescript-eslint/utils';
import { AST_NODE_TYPES } from '@typescript-eslint/utils';

/**
 * 装饰器白名单（08 篇"支持的语言特性"表，共 14 个）。
 * 白名单外的装饰器一律编码期报错。
 */
export const KNOWN_DECORATORS: ReadonlySet<string> = new Set([
  'Entry',
  'Component',
  'State',
  'Prop',
  'Link',
  'Provide',
  'Consume',
  'Observed',
  'ObjectLink',
  'Watch',
  'Builder',
  'Styles',
  'Extend',
  'StorageLink',
]);

/**
 * UI 组件调用名集合（03 篇组件映射表 + 08 篇组件条目）。
 * 用于"build() 外的 UI 调用"与"根节点计数"检查。
 */
export const UI_COMPONENTS: ReadonlySet<string> = new Set([
  // 布局容器（03 篇）
  'Column',
  'Row',
  'Stack',
  'Flex',
  'Scroll',
  'List',
  'ListItem',
  'Grid',
  'GridItem',
  'Swiper',
  // 基础组件（03 篇）
  'Text',
  'Image',
  'Button',
  'TextInput',
  'TextArea',
  'Toggle',
  'Checkbox',
  'Radio',
  'Slider',
  'Progress',
  'LoadingProgress',
  'Divider',
  'Blank',
  'Badge',
  'Tabs',
  'TabContent',
  'Web',
  'Video',
  'Canvas',
  // 控制流（03 篇）
  'ForEach',
  // 08 篇"不支持/需降级"条目中的组件名
  'Navigation',
  'NavDestination',
  'Refresh',
  'WaterFlow',
  'RelativeContainer',
]);

/** 提取装饰器名：`@State` → 'State'，`@Watch('x')` → 'Watch'，其他形式返回 null */
export function getDecoratorName(decorator: TSESTree.Decorator): string | null {
  const expr = decorator.expression;
  if (expr.type === AST_NODE_TYPES.Identifier) {
    return expr.name;
  }
  if (
    expr.type === AST_NODE_TYPES.CallExpression &&
    expr.callee.type === AST_NODE_TYPES.Identifier
  ) {
    return expr.callee.name;
  }
  return null;
}

/** 判断类成员是否 UI 构建上下文（build() 或 @Builder 标注的方法）；其他节点返回 null 继续向上 */
function isBuilderDefinition(node: TSESTree.Node): boolean | null {
  if (
    node.type === AST_NODE_TYPES.MethodDefinition ||
    node.type === AST_NODE_TYPES.PropertyDefinition
  ) {
    if (node.key.type === AST_NODE_TYPES.Identifier && node.key.name === 'build') {
      return true;
    }
    return (node.decorators ?? []).some((d) => getDecoratorName(d) === 'Builder');
  }
  return null;
}

/**
 * 节点是否位于 UI 构建上下文（build() 方法或 @Builder 函数）内。
 * 箭头函数 / 回调为透明层（如 ForEach 循环体、onClick 闭包）。
 */
export function isInBuilderContext(node: TSESTree.Node): boolean {
  let current: TSESTree.Node | undefined = node.parent;
  while (current) {
    const verdict = isBuilderDefinition(current);
    if (verdict !== null) {
      return verdict;
    }
    current = current.parent;
  }
  return false;
}

/** 节点是否位于 build() 方法内（不含 @Builder） */
export function isInBuildMethod(node: TSESTree.Node): boolean {
  let current: TSESTree.Node | undefined = node.parent;
  while (current) {
    if (
      current.type === AST_NODE_TYPES.MethodDefinition ||
      current.type === AST_NODE_TYPES.PropertyDefinition
    ) {
      return current.key.type === AST_NODE_TYPES.Identifier && current.key.name === 'build';
    }
    if (current.type === AST_NODE_TYPES.FunctionDeclaration) {
      return false;
    }
    current = current.parent;
  }
  return false;
}

/** 剥开成员表达式链，返回最左侧对象（如 this.user.name → ThisExpression 节点） */
export function getRootObject(node: TSESTree.Node): TSESTree.Node {
  let current = node;
  while (current.type === AST_NODE_TYPES.MemberExpression) {
    current = current.object;
  }
  return current;
}

/** 标识符调用名（仅匹配 `foo(...)` 形式的直接调用） */
export function getCallName(node: TSESTree.CallExpression): string | null {
  return node.callee.type === AST_NODE_TYPES.Identifier ? node.callee.name : null;
}

/** 成员调用属性名（匹配 `x.foo(...)` / `x['foo'](...)`） */
export function getMemberCallName(node: TSESTree.CallExpression): string | null {
  if (node.callee.type !== AST_NODE_TYPES.MemberExpression) {
    return null;
  }
  const prop = node.callee.property;
  if (prop.type === AST_NODE_TYPES.Identifier) {
    return prop.name;
  }
  if (prop.type === AST_NODE_TYPES.Literal && typeof prop.value === 'string') {
    return prop.value;
  }
  return null;
}
