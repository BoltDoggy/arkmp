export type {
  BindingExpression,
  ComponentModel,
  EventCall,
  Expression,
  ForEachNode,
  IfNode,
  LifecycleHooks,
  MethodCallExpression,
  MethodDecl,
  ObjectExpression,
  PropField,
  StateField,
  StaticExpression,
  StyleCall,
  UIChildNode,
  UINode,
  WxsMethodDecl,
} from './types';
export { assignNodeIds, walkModelTrees, walkUIChildren } from './node-ids';
export { IR_ERROR_CODES, validateIR } from './validate';
export { deserializeIR, serializeIR } from './serialize';
