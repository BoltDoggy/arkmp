import { describe, expect, it } from 'vitest';
import { parse, preprocessStruct } from '@arkmp/parser';

describe('preprocessStruct', () => {
  it('将 struct 声明替换为 class，且不换行', () => {
    const source = '@Entry\n@Component\nstruct Index {\n  build() {}\n}\n';
    const { code } = preprocessStruct(source);
    expect(code).toBe('@Entry\n@Component\nclass Index {\n  build() {}\n}\n');
  });

  it('位置映射可回溯替换点之后的列偏移', () => {
    const source = 'struct Index {}';
    const { code, positionMap } = preprocessStruct(source);
    expect(code).toBe('class Index {}');
    // 'Index' 在生成代码中位于第 7 列（1 起始），原始源码在第 8 列
    expect(positionMap.toOriginal(1, 7)).toEqual({ line: 1, column: 8 });
    // 替换点之前的列不受影响
    expect(positionMap.toOriginal(1, 3)).toEqual({ line: 1, column: 3 });
  });

  it('同一行多处替换时偏移量累计', () => {
    const source = 'struct A {}\nstruct B { struct C {} }';
    const { code, positionMap } = preprocessStruct(source);
    expect(code).toBe('class A {}\nclass B { class C {} }');
    // 第 2 行第二处替换之后：生成列 21（'C'）→ 原始列 23
    expect(positionMap.toOriginal(2, 21)).toEqual({ line: 2, column: 23 });
    // 第一处替换之后、第二处替换之前：偏移为 1
    expect(positionMap.toOriginal(2, 7)).toEqual({ line: 2, column: 8 });
  });

  it('不误伤普通标识符（如 structCount）', () => {
    const source = 'const structCount = 1;';
    const { code, positionMap } = preprocessStruct(source);
    expect(code).toBe(source);
    expect(positionMap.entries).toHaveLength(0);
  });
});

describe('parse', () => {
  it('尾随块之后的链式调用经标记插入后无语法错误', () => {
    const source = [
      '@Component',
      'struct Index {',
      '  build() {',
      '    Column({ space: 12 }) {',
      "      Text('a')",
      '    }',
      "    .width('100%')",
      '    .justifyContent(FlexAlign.Center)',
      '  }',
      '}',
      '',
    ].join('\n');
    const { sourceFile, diagnostics } = parse(source);
    expect(diagnostics).toHaveLength(0);
    expect(sourceFile.getText(sourceFile)).toContain("__arkmp_chain.width('100%')");
  });

  it('标记插入行的列号可回溯（插入点之后列号前移）', () => {
    // 第 3 行插入 13 字符标记：生成代码第 18 列起原始列 = 生成列 - 13
    const source = 'Column() {\n}\n  .width(1)\n';
    const { positionMap } = parse(source);
    expect(positionMap.toOriginal(3, 5)).toEqual({ line: 3, column: 5 }); // 标记文本内
    expect(positionMap.toOriginal(3, 16)).toEqual({ line: 3, column: 3 }); // '.' 回到原始第 3 列
    expect(positionMap.toOriginal(3, 17)).toEqual({ line: 3, column: 4 });
  });

  it('解析合法源码，无诊断', () => {
    const source = '@Entry\n@Component\nstruct Index {\n  @State count: number = 0;\n  build() {}\n}\n';
    const { sourceFile, diagnostics } = parse(source, 'pages/Index.ets');
    expect(diagnostics).toHaveLength(0);
    expect(sourceFile.statements).toHaveLength(1);
  });

  it('装饰器参数中的对象字面量保持原样', () => {
    const source = '@Entry({ routeName: \'home\' })\n@Component\nstruct Index {\n  build() {}\n}\n';
    const { sourceFile, diagnostics } = parse(source);
    expect(diagnostics).toHaveLength(0);
    const cls = sourceFile.statements[0];
    expect(cls.getText(sourceFile)).toContain("@Entry({ routeName: 'home' })");
  });

  it('语法错误收集为 Diagnostic，行列回溯到原始源码', () => {
    // 原始源码第 3 行：struct 占 6 列，class 占 5 列，错误列需 +1 回溯
    const source = '@Component\nstruct Index {\n  @State count: number = ;\n}\n';
    const { diagnostics } = parse(source, 'pages/Index.ets');
    expect(diagnostics).toHaveLength(1);
    const d = diagnostics[0];
    expect(d.level).toBe('error');
    expect(d.code).toBe('E1006');
    expect(d.file).toBe('pages/Index.ets');
    expect(d.line).toBe(3);
    // `;` 在第 26 列，原始源码第 3 行无 struct，列一致
    expect(d.column).toBe(26);
  });

  it('struct 所在行的语法错误列号经 positionMap 回溯', () => {
    // 错误在 struct 关键字之后，原始列 = 生成列 + 1
    const source = 'struct 123 {}';
    const { diagnostics } = parse(source);
    expect(diagnostics.length).toBeGreaterThan(0);
    expect(diagnostics[0].line).toBe(1);
    expect(diagnostics[0].column).toBe(8); // 生成代码第 7 列 → 原始第 8 列
  });
});
