/**
 * `.ets` 源码的文本级预处理（02 篇①）。
 *
 * 包含两趟不换行的改写，均通过 PositionMap 支持生成代码 → 原始源码的行列回溯：
 *
 * 1. `struct X {` → `class X {`：ArkUI 的 `struct` 组件声明不是合法 TS 语法，
 *    替换为 `class` 使 TS 解析器可直接消费（`struct` 比 `class` 长 1 字符，产生列偏移）。
 * 2. 尾随子节点块之后的链式调用（ArkUI 特有写法）：
 *    ```text
 *    Column({ space: 12 }) {
 *      Text('a')
 *    }
 *    .width('100%')
 *    ```
 *    `}` 之后另起一行的 `.width(...)` 不是合法 TS 语句。预处理在这类行首 `.`
 *    之前插入标记标识符 `__arkmp_chain`，使其成为合法表达式语句
 *    `__arkmp_chain.width('100%')`，由 analyzer 识别并挂回前一个组件节点。
 *    判定规则：一行以 `.标识符` 开头，且上一行以 `}` 结尾或上一行本身已被标记。
 *
 * 已知限制：纯文本替换，不感知字符串/注释上下文；字符串字面量中恰好出现
 * 上述形态的文本也会被改写（可编译语法子集内不构成实际问题）。
 */

/** 行首链式调用插入的标记标识符（analyzer 据此识别续链语句）。 */
export const CHAIN_MARKER = '__arkmp_chain';

/**
 * 单条列偏移记录：生成代码某行从 `fromColumn`（1 起始）起，
 * 原始列 = 生成列 + Σ（全部适用记录的 delta）。
 */
export interface PositionMapEntry {
  /** 1 起始行号（预处理不换行，生成代码与原始源码行号一致） */
  line: number;
  /** 1 起始列号：生成代码中从该列起本条偏移生效 */
  fromColumn: number;
  /** 本条记录对「原始列 = 生成列 + delta」的贡献（struct→class 为 +1，标记插入为 -标记长度） */
  delta: number;
}

/** 生成代码 → 原始源码的位置映射。 */
export interface PositionMap {
  /** 全部偏移记录，按行列升序 */
  entries: PositionMapEntry[];
  /** 将生成代码的 1 起始行列回溯为原始源码的 1 起始行列 */
  toOriginal(line: number, column: number): { line: number; column: number };
}

/** preprocessStruct / preprocessChainContinuations 的返回值。 */
export interface PreprocessResult {
  /** 预处理后的代码 */
  code: string;
  positionMap: PositionMap;
}

/** 匹配 struct 声明关键字：词边界 + 后面跟标识符（避免误伤普通标识符）。 */
const STRUCT_PATTERN = /\bstruct\b(?=\s+[$\w])/g;

/** 以 `.标识符` 开头的行（捕获前导空白）。 */
const CHAIN_LINE_PATTERN = /^(\s*)\.([A-Za-z_$])/;

function createPositionMap(entries: PositionMapEntry[]): PositionMap {
  const sorted = [...entries].sort((a, b) => a.line - b.line || a.fromColumn - b.fromColumn);
  return {
    entries: sorted,
    toOriginal(line, column) {
      let delta = 0;
      for (const entry of sorted) {
        if (entry.line === line && column >= entry.fromColumn) {
          delta += entry.delta;
        }
      }
      return { line, column: column + delta };
    },
  };
}

/**
 * 将源码中的 `struct X` 声明替换为 `class X`，并记录位置映射。
 */
export function preprocessStruct(source: string): PreprocessResult {
  const entries: PositionMapEntry[] = [];
  const lines = source.split('\n');
  const output: string[] = [];

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    STRUCT_PATTERN.lastIndex = 0;
    let replaced = '';
    let cursor = 0;
    let count = 0;
    for (let match = STRUCT_PATTERN.exec(line); match !== null; match = STRUCT_PATTERN.exec(line)) {
      // 'class' 在生成代码中的起始 0 起始下标：原始下标减去之前替换缩短的字符数
      const generatedStart = match.index - count;
      count += 1;
      entries.push({
        line: lineIndex + 1,
        // 'class' 占 5 列，从其后一列（1 起始）起每处替换贡献 +1
        fromColumn: generatedStart + 6,
        delta: 1,
      });
      replaced += line.slice(cursor, match.index) + 'class';
      cursor = match.index + match[0].length;
    }
    output.push(count === 0 ? line : replaced + line.slice(cursor));
  }

  return { code: output.join('\n'), positionMap: createPositionMap(entries) };
}

/**
 * 在行首链式调用前插入 CHAIN_MARKER，使其成为合法 TS 表达式语句，并记录位置映射。
 * 标记长度造成的列偏移（delta = -标记长度）计入 PositionMap。
 */
export function preprocessChainContinuations(source: string): PreprocessResult {
  const entries: PositionMapEntry[] = [];
  const lines = source.split('\n');
  const output: string[] = [];
  let previousEndsWithBrace = false;
  let previousMarked = false;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    const match = CHAIN_LINE_PATTERN.exec(line);
    if (match !== null && (previousEndsWithBrace || previousMarked)) {
      const insertColumn = match[1].length + 1; // 1 起始，标记插入在前导空白之后
      entries.push({
        line: lineIndex + 1,
        fromColumn: insertColumn + CHAIN_MARKER.length,
        delta: -CHAIN_MARKER.length,
      });
      output.push(`${match[1]}${CHAIN_MARKER}${line.slice(match[1].length)}`);
      previousMarked = true;
      previousEndsWithBrace = false;
    } else {
      output.push(line);
      previousMarked = false;
      previousEndsWithBrace = line.trimEnd().endsWith('}');
    }
  }

  return { code: output.join('\n'), positionMap: createPositionMap(entries) };
}

/** 组合多趟预处理的位置映射（要求各趟均不换行，条目求和语义下可直接合并）。 */
export function composePositionMaps(...maps: PositionMap[]): PositionMap {
  return createPositionMap(maps.flatMap((m) => m.entries));
}
