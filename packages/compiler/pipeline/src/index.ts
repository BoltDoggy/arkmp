/**
 * @arkmp/pipeline —— L4 单文件编译编排（docs/arkui-miniprogram/02-pipeline.md
 * 六阶段管线的可执行形式，09 篇「@arkmp/pipeline 是无 I/O 纯函数」）。
 *
 * `compile(source, options)` 串起全部阶段：
 *
 * ```text
 * parse（① .ets → TS AST，位置映射）
 *   → analyze（②③ AST → ComponentModel，分配节点 id）
 *   → transform-events（④ 事件表 + 回调方法抽取）
 *   → transform-wxss（④ styleCalls → WXSS 类 + 内联表）
 *   → transform-wxml（④ buildTree → WXML，合并 wxss 的 classMap/inlineStyles）
 *   → transform-js（④⑤ model + 事件方法 → createPage/createComponent）
 *   → transform-json（⑤ → 页面/组件配置）
 *   → emit（⑤ 四件套拼装 + sourcemap）
 * ```
 *
 * 约定：
 * - 纯函数，无文件 I/O；同一输入产出完全一致；
 * - events 先于 js：其 methods 作为 transformJs 的 eventMethods 传入
 *   （赋值改写在 transform-js 统一执行，见 transform-events 头部协议）；
 * - 诊断全阶段汇总：parser 诊断已回溯原始源码行列；analyzer 诊断的行列是
 *   预处理代码坐标，本包用 parse 的 positionMap 回溯；transform 诊断若携带
 *   IR 节点 loc（同为预处理坐标），同样用 positionMap 回溯，并统一补上 `file`；
 * - 有 error 级诊断时仍返回部分产物，调用方按 `hasErrors` 判定是否阻断；
 * - 文件名约定：`index.ets` → `index.wxml/wxss/js/json`（目录部分保留）。
 */

import type { Diagnostic } from '@arkmp/diagnostics';
import type { ComponentModel } from '@arkmp/ir';
import { parse } from '@arkmp/parser';
import type { PositionMap } from '@arkmp/parser';
import { analyze } from '@arkmp/analyzer';
import { transformEvents } from '@arkmp/transform-events';
import { transformWxss } from '@arkmp/transform-wxss';
import { transformWxml } from '@arkmp/transform-wxml';
import { transformJs } from '@arkmp/transform-js';
import { transformJson } from '@arkmp/transform-json';
import { emit } from '@arkmp/emitter';
import type { EmittedFile } from '@arkmp/emitter';

export interface CompileOptions {
  /** 源文件名，如 `index.ets`；产物路径由其派生，缺省 `index.ets` */
  fileName?: string;
  /** vp→rpx 换算系数，透传 transform-wxss（默认 2） */
  unitRatio?: number;
  /** WXSS 类名前缀，透传 transform-wxss（默认 `arkmp-`） */
  classPrefix?: string;
  /** 生成 js sourcemap（`.js.map`，v3，sources 指回 .ets） */
  sourcemap?: boolean;
  /** 强制按页面/组件产物生成；缺省按 `@Entry` 推断（model.isEntry） */
  isPage?: boolean;
}

export interface CompileResult {
  /** 四件套产物（`sourcemap: true` 时含 `.js.map`），按 wxml/wxss/js/json 序 */
  files: EmittedFile[];
  /** 全阶段汇总诊断（parser → analyzer → transforms），位置已回溯原始源码 */
  diagnostics: Diagnostic[];
  /** 编译核心 IR（供增量缓存、依赖分析等上层使用） */
  model: ComponentModel;
  /** 是否存在 error 级诊断（存在即应阻断构建；产物仍会返回） */
  hasErrors: boolean;
}

/** analyzer 诊断的行列是预处理代码坐标，用 positionMap 回溯到原始源码。 */
function remapToOriginal(d: Diagnostic, positionMap: PositionMap): Diagnostic {
  if (d.line === undefined) return d;
  const original = positionMap.toOriginal(d.line, d.column ?? 1);
  return {
    ...d,
    line: original.line,
    column: d.column === undefined ? undefined : original.column,
  };
}

/**
 * 编译单个 `.ets` 源文件为小程序四件套。纯函数编排，见文件头管线图。
 */
export function compile(source: string, options: CompileOptions = {}): CompileResult {
  const fileName = options.fileName ?? 'index.ets';

  // ① parse：语法错误不抛异常，收集为 error 诊断（行列已回溯）
  const parsed = parse(source, fileName);
  // ②③ analyze：AST → ComponentModel（行列需 positionMap 回溯）
  const analyzed = analyze(parsed.sourceFile, fileName);
  const { model } = analyzed;

  // ④ 四条转换链（events 先于 js；wxss 先于 wxml 以合并 classMap/inlineStyles）
  const events = transformEvents(model);
  const wxss = transformWxss(model.buildTree, {
    unitRatio: options.unitRatio,
    classPrefix: options.classPrefix,
  });
  const wxml = transformWxml(model.buildTree, {
    classMap: wxss.classMap,
    inlineStyles: wxss.inlineStyles,
  });
  const js = transformJs(model, { isPage: options.isPage, eventMethods: events.methods });
  const json = transformJson(model);

  // ⑤ emit：四件套拼装（有 error 诊断时仍产出，由调用方按 hasErrors 判定）
  const files = emit(
    { wxml: wxml.wxml, wxss: wxss.wxss, js: js.js, json: json.json },
    { fileName, sourcemap: options.sourcemap, source },
  );

  const diagnostics: Diagnostic[] = [
    ...parsed.diagnostics,
    ...analyzed.diagnostics.map((d) => remapToOriginal(d, parsed.positionMap)),
    ...wxml.diagnostics.map((d) => remapToOriginal(d, parsed.positionMap)),
    ...wxss.diagnostics,
    ...js.diagnostics,
    ...json.diagnostics,
  ].map((d) => (d.file === undefined ? { ...d, file: fileName } : d));

  return {
    files,
    diagnostics,
    model,
    hasErrors: diagnostics.some((d) => d.level === 'error'),
  };
}
