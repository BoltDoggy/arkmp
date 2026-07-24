/**
 * @arkmp/transform-json —— L2 页面/组件配置转换（02 篇⑤ `.json` 产物）。
 *
 * 输入 ComponentModel（IR），输出小程序 `.json` 配置对象：
 * - 页面（`@Entry`）：`@Entry({...})` 的静态参数按 05 篇「页面行为配置」
 *   映射为页面 json 字段（如 `title` → `navigationBarTitleText`，
 *   `pullRefresh` → `enablePullDownRefresh`）；
 * - 组件（`@Component`）：`{ "component": true }`；
 * - `usingComponents` 由调用方（工程层解析组件引用后）通过 options 传入，
 *   本包只负责合并，不做路径推导（预留）。
 *
 * 诊断码：W5001（未识别的 `@Entry` 配置项，原样透传并 warning）。
 */

import type { Diagnostic } from '@arkmp/diagnostics';
import { warningDiagnostic } from '@arkmp/diagnostics';
import type { ComponentModel } from '@arkmp/ir';

/** transform-json 诊断码。 */
export const TRANSFORM_JSON_WARNING_CODES = {
  /** 未识别的 @Entry 配置项：无法映射，原样透传 */
  UNKNOWN_ENTRY_OPTION: 'W5001',
} as const;

/** `@Entry({...})` 参数 → 页面 json 字段映射表（05 篇「页面行为配置」）。 */
const ENTRY_OPTION_MAP: Record<string, string> = {
  title: 'navigationBarTitleText',
  pullRefresh: 'enablePullDownRefresh',
};

export interface TransformJsonOptions {
  /**
   * 自定义组件引用表（标签名 → 组件路径），由工程层解析后传入。
   * 页面与组件产物均会合并为 `usingComponents` 字段。
   */
  usingComponents?: Record<string, string>;
}

export interface TransformJsonResult {
  json: Record<string, unknown>;
  diagnostics: Diagnostic[];
}

/**
 * 生成 `.json` 配置对象（02 篇⑤）。
 * `model.isEntry` 决定页面/组件两种形态；`isEntry` 但无 `entryOptions` 时
 * 页面 json 为空对象（小程序允许 `{}`）。
 */
export function transformJson(model: ComponentModel, options: TransformJsonOptions = {}): TransformJsonResult {
  const diagnostics: Diagnostic[] = [];
  const json: Record<string, unknown> = {};

  if (!model.isEntry) {
    json.component = true;
  } else if (model.entryOptions !== undefined) {
    for (const key of Object.keys(model.entryOptions)) {
      const target = ENTRY_OPTION_MAP[key];
      if (target !== undefined) {
        json[target] = model.entryOptions[key];
      } else {
        json[key] = model.entryOptions[key];
        diagnostics.push(
          warningDiagnostic(
            TRANSFORM_JSON_WARNING_CODES.UNKNOWN_ENTRY_OPTION,
            `未识别的 @Entry 配置项 "${key}"：已原样透传到页面 json`,
            { help: '见 docs/arkui-miniprogram/05-state-lifecycle-mapping.md「页面行为配置」映射表' },
          ),
        );
      }
    }
  }

  if (options.usingComponents !== undefined && Object.keys(options.usingComponents).length > 0) {
    json.usingComponents = { ...options.usingComponents };
  }

  return { json, diagnostics };
}
