import type { Diagnostic } from '@arkmp/diagnostics';
import { errorDiagnostic } from '@arkmp/diagnostics';
import ts from 'typescript';
import { composePositionMaps, preprocessChainContinuations, preprocessStruct, type PositionMap } from './preprocess';

/** parser 阶段诊断码（E1xxx：语法/组件不可编译，见 08 篇诊断码总表）。 */
export const PARSER_ERROR_CODES = {
  /** TS 语法解析错误 */
  SYNTAX_ERROR: 'E1006',
} as const;

/** parse 的返回值。 */
export interface ParseResult {
  /** TS AST（`struct` 已预处理为 `class`） */
  sourceFile: ts.SourceFile;
  /** 生成代码 → 原始源码的位置映射，供上层回溯诊断行列 */
  positionMap: PositionMap;
  /** 语法错误诊断（行列已经 positionMap 回溯到原始源码） */
  diagnostics: Diagnostic[];
}

/**
 * 解析 `.ets` 源码为 TS AST（02 篇①）。
 *
 * - `struct` → `class` 与行首链式调用标记插入的预处理见 preprocess.ts；
 * - 装饰器（`@Entry`/`@State` 等）由 TS 解析器原生支持，无需特殊处理；
 * - 语法错误不抛异常，收集为 error 级 Diagnostic。
 */
export function parse(source: string, fileName = 'index.ets'): ParseResult {
  const chains = preprocessChainContinuations(source);
  const structs = preprocessStruct(chains.code);
  const positionMap = composePositionMaps(structs.positionMap, chains.positionMap);
  const { code } = structs;
  const sourceFile = ts.createSourceFile(fileName, code, ts.ScriptTarget.ES2020, true, ts.ScriptKind.TS);

  // ts.createSourceFile 不通过公开 API 暴露语法诊断，parseDiagnostics 是事实标准入口
  const parseDiagnostics =
    (sourceFile as unknown as { parseDiagnostics?: ts.DiagnosticWithLocation[] }).parseDiagnostics ?? [];
  const diagnostics: Diagnostic[] = parseDiagnostics
    // ArkUI 的尾随子节点块 `Column({...}) { ... }` 在 TS 中是「表达式语句 + 块」，
    // 会产生可恢复的 "';' expected" 诊断（位置在 `{` 上）；属合法 ArkUI 写法，过滤掉。
    .filter((d) => !(ts.flattenDiagnosticMessageText(d.messageText, '\n') === "';' expected." && code.charAt(d.start) === '{'))
    .map((d) => {
      const generated = ts.getLineAndCharacterOfPosition(sourceFile, d.start);
      const original = positionMap.toOriginal(generated.line + 1, generated.character + 1);
      return errorDiagnostic(PARSER_ERROR_CODES.SYNTAX_ERROR, ts.flattenDiagnosticMessageText(d.messageText, '\n'), {
        file: fileName,
        line: original.line,
        column: original.column,
      });
    });

  return { sourceFile, positionMap, diagnostics };
}
