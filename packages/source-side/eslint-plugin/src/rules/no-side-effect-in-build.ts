import { AST_NODE_TYPES } from '@typescript-eslint/utils';

import { createRule } from '../create-rule.js';
import { getMemberCallName, getRootObject, isInBuildMethod } from '../utils.js';

type MessageIds = 'modifyState' | 'sideEffectCall';

/** build() 中禁止的副作用调用（发请求、定时器） */
const SIDE_EFFECT_CALLS: ReadonlySet<string> = new Set([
  'setTimeout',
  'setInterval',
  'setImmediate',
  'fetch',
]);

/**
 * no-side-effect-in-build：build() 中禁止副作用。
 * 对应 08 篇"build() 约束"第 1 条（发请求、改状态、定时器一律编译期报错）。
 */
export const noSideEffectInBuild = createRule<[], MessageIds>({
  name: 'no-side-effect-in-build',
  meta: {
    type: 'problem',
    docs: {
      description: '禁止在 build() 中修改状态或发起副作用调用（08 篇 build() 约束）',
    },
    messages: {
      modifyState: 'build() 中禁止修改状态（{{text}}），状态修改请放到事件回调中（08 篇 build() 约束）',
      sideEffectCall:
        'build() 中禁止副作用调用 {{name}}（发请求/定时器等），编译期报错（08 篇 build() 约束）',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return {
      AssignmentExpression(node) {
        if (!isInBuildMethod(node)) {
          return;
        }
        if (getRootObject(node.left).type === AST_NODE_TYPES.ThisExpression) {
          context.report({
            node,
            messageId: 'modifyState',
            data: { text: context.sourceCode.getText(node.left) },
          });
        }
      },
      UpdateExpression(node) {
        if (!isInBuildMethod(node)) {
          return;
        }
        if (getRootObject(node.argument).type === AST_NODE_TYPES.ThisExpression) {
          context.report({
            node,
            messageId: 'modifyState',
            data: { text: context.sourceCode.getText(node.argument) },
          });
        }
      },
      CallExpression(node) {
        if (!isInBuildMethod(node)) {
          return;
        }
        if (
          node.callee.type === AST_NODE_TYPES.Identifier &&
          SIDE_EFFECT_CALLS.has(node.callee.name)
        ) {
          context.report({
            node,
            messageId: 'sideEffectCall',
            data: { name: `${node.callee.name}()` },
          });
          return;
        }
        // http.request 等源码侧 API 调用（06 篇命名空间）同样属于副作用
        if (getMemberCallName(node) === 'request' && isHttpNamespace(node)) {
          context.report({ node, messageId: 'sideEffectCall', data: { name: 'http.request()' } });
        }
      },
    };
    function isHttpNamespace(node: import('@typescript-eslint/utils').TSESTree.CallExpression) {
      return (
        node.callee.type === AST_NODE_TYPES.MemberExpression &&
        node.callee.object.type === AST_NODE_TYPES.Identifier &&
        node.callee.object.name === 'http'
      );
    }
  },
});
