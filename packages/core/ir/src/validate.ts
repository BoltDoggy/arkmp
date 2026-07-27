import type { Diagnostic } from '@arkmp/diagnostics';
import { walkModelTrees } from './node-ids';
import type { ComponentModel, Expression } from './types';

/** IR 校验错误码（E1xxx 段为 IR 结构错误）。 */
export const IR_ERROR_CODES = {
  EMPTY_COMPONENT_NAME: 'E1001',
  DUPLICATE_FIELD: 'E1002',
  INVALID_NODE: 'E1003',
  DUPLICATE_NODE_ID: 'E1004',
  INVALID_BINDING: 'E1005',
} as const;

function validateExpression(expr: Expression, where: string, out: Diagnostic[]): void {
  if (expr.kind === 'binding' && expr.path.trim() === '') {
    out.push({
      level: 'error',
      code: IR_ERROR_CODES.INVALID_BINDING,
      message: `绑定表达式缺少状态路径（${where}）`,
    });
  }
  if (expr.kind === 'object') {
    for (const value of Object.values(expr.properties)) {
      validateExpression(value, where, out);
    }
  }
}

/**
 * 校验 ComponentModel 的结构完整性，返回诊断数组（空数组 = 校验通过）。
 * 校验项：组件名、字段重名、UI 节点必要字段、节点 id 唯一性、绑定表达式路径。
 */
export function validateIR(model: ComponentModel): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  if (model.name.trim() === '') {
    diagnostics.push({
      level: 'error',
      code: IR_ERROR_CODES.EMPTY_COMPONENT_NAME,
      message: '组件名为空',
    });
  }

  const seenFields = new Set<string>();
  for (const field of [...model.states, ...model.props]) {
    if (seenFields.has(field.name)) {
      diagnostics.push({
        level: 'error',
        code: IR_ERROR_CODES.DUPLICATE_FIELD,
        message: `字段重名：${field.name}`,
      });
    }
    seenFields.add(field.name);
  }

  const seenIds = new Set<string>();
  walkModelTrees(model, (node) => {
    const where = node.id !== undefined ? `节点 ${node.id}` : `节点（${node.type}）`;
    if (node.type === 'component' && node.component.trim() === '') {
      diagnostics.push({
        level: 'error',
        code: IR_ERROR_CODES.INVALID_NODE,
        message: `UI 节点缺少组件名（${where}）`,
      });
    }
    if (node.type === 'foreach' && node.itemName.trim() === '') {
      diagnostics.push({
        level: 'error',
        code: IR_ERROR_CODES.INVALID_NODE,
        message: `ForEach 节点缺少迭代变量名（${where}）`,
      });
    }
    if (node.id !== undefined) {
      if (seenIds.has(node.id)) {
        diagnostics.push({
          level: 'error',
          code: IR_ERROR_CODES.DUPLICATE_NODE_ID,
          message: `节点 id 重复：${node.id}`,
        });
      }
      seenIds.add(node.id);
    }
    if (node.type === 'component') {
      for (const param of node.params) {
        validateExpression(param, where, diagnostics);
      }
      for (const call of node.styleCalls) {
        for (const arg of call.args) {
          validateExpression(arg, `${where} 的 .${call.name}()`, diagnostics);
        }
      }
    }
    if (node.type === 'if') {
      validateExpression(node.condition, where, diagnostics);
    }
    if (node.type === 'foreach') {
      validateExpression(node.items, where, diagnostics);
    }
  });

  return diagnostics;
}
