/**
 * @arkmp/eslint-plugin — ArkMP 源码侧（.ets）编码期越界检查。
 *
 * 每条规则对应 docs/arkui-miniprogram/08-limitations.md 的一条限制，
 * 在编码期给出与编译期一致的诊断（E1xxx/W2xxx/E3xxx 语义）。
 */

import { noConcurrent } from './rules/no-concurrent.js';
import { noDegradedCapability } from './rules/no-degraded-capability.js';
import { noDynamicThisAccess } from './rules/no-dynamic-this-access.js';
import { noGeometryTransition } from './rules/no-geometry-transition.js';
import { noLazyForEach } from './rules/no-lazy-foreach.js';
import { noMiniprogramApi } from './rules/no-miniprogram-api.js';
import { noSideEffectInBuild } from './rules/no-side-effect-in-build.js';
import { noUiCallOutsideBuild } from './rules/no-ui-call-outside-build.js';
import { noUnknownDecorator } from './rules/no-unknown-decorator.js';
import { noUnsupportedComponent } from './rules/no-unsupported-component.js';
import { noVar } from './rules/no-var.js';
import { noWrapBuilder } from './rules/no-wrap-builder.js';
import { requireLiteralDecoratorArgs } from './rules/require-literal-decorator-args.js';
import { singleRootNode } from './rules/single-root-node.js';

export const rules = {
  'no-unknown-decorator': noUnknownDecorator,
  'no-ui-call-outside-build': noUiCallOutsideBuild,
  'no-side-effect-in-build': noSideEffectInBuild,
  'single-root-node': singleRootNode,
  'no-lazy-foreach': noLazyForEach,
  'no-geometry-transition': noGeometryTransition,
  'no-concurrent': noConcurrent,
  'no-wrap-builder': noWrapBuilder,
  'no-dynamic-this-access': noDynamicThisAccess,
  'no-unsupported-component': noUnsupportedComponent,
  'no-degraded-capability': noDegradedCapability,
  'no-miniprogram-api': noMiniprogramApi,
  'require-literal-decorator-args': requireLiteralDecoratorArgs,
  'no-var': noVar,
} as const;

export type RuleName = keyof typeof rules;

/**
 * recommended 规则级别：与 08 篇诊断级别对齐——
 * E 级（编译期 error）为 'error'，W 级（降级提示）为 'warn'；
 * 「ArkTS 编码风格建议」类规则（如 no-var，无编译期诊断码）同为 'warn'。
 */
export const recommendedRules: Record<`arkmp/${RuleName}`, 'error' | 'warn'> = {
  'arkmp/no-unknown-decorator': 'error',
  'arkmp/no-ui-call-outside-build': 'error',
  'arkmp/no-side-effect-in-build': 'error',
  'arkmp/single-root-node': 'error',
  'arkmp/no-lazy-foreach': 'error',
  'arkmp/no-geometry-transition': 'error',
  'arkmp/no-concurrent': 'error',
  'arkmp/no-wrap-builder': 'error',
  'arkmp/no-dynamic-this-access': 'warn',
  'arkmp/no-unsupported-component': 'error',
  'arkmp/no-degraded-capability': 'warn',
  'arkmp/no-miniprogram-api': 'error',
  'arkmp/require-literal-decorator-args': 'error',
  'arkmp/no-var': 'warn',
};

const plugin = {
  meta: { name: '@arkmp/eslint-plugin', version: '0.1.0' },
  rules,
  configs: {} as Record<string, unknown>,
};

/** flat config 形式的推荐配置 */
plugin.configs = {
  recommended: {
    plugins: { arkmp: plugin },
    rules: recommendedRules,
  },
};

export const configs = plugin.configs;

export default plugin;
