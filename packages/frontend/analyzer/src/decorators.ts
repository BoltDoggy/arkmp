import ts from 'typescript';

/**
 * 装饰器白名单（08 篇「支持的语言特性」，取任务要求的可编译子集）：
 * - 组件级：@Entry / @Component
 * - 字段级：@State / @Prop / @Link / @Watch
 * - 方法级：@Builder / @Styles / @Extend
 */
export const DECORATOR_WHITELIST = [
  'Entry',
  'Component',
  'State',
  'Prop',
  'Link',
  'Watch',
  'Builder',
  'Styles',
  'Extend',
] as const;

export type WhitelistedDecorator = (typeof DECORATOR_WHITELIST)[number];

/** 取装饰器名：`@Entry` 与 `@Entry({...})` 均返回 'Entry'。 */
export function decoratorName(decorator: ts.Decorator): string {
  const expr = decorator.expression;
  if (ts.isIdentifier(expr)) return expr.text;
  if (ts.isCallExpression(expr) && ts.isIdentifier(expr.expression)) return expr.expression.text;
  return expr.getText();
}

/** 取节点的装饰器列表（TS 5.x 统一入口，无装饰器时返回空数组）。 */
export function getDecorators(node: ts.Node): ts.Decorator[] {
  return ts.canHaveDecorators(node) ? [...(ts.getDecorators(node) ?? [])] : [];
}
