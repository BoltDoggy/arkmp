import { describe, expect, it } from 'vitest';
import {
  DiagnosticCollector,
  errorDiagnostic,
  formatDiagnostic,
  warningDiagnostic,
} from '@arkmp/diagnostics';

describe('formatDiagnostic', () => {
  it('完整位置信息：对齐 02 篇格式', () => {
    const output = formatDiagnostic({
      level: 'error',
      code: 'E1023',
      file: 'pages/Index.ets',
      line: 24,
      column: 9,
      message: '不支持的组件：Video（小程序端请使用 ArkMP 的 <Video> 适配组件）',
      help: '见 docs/arkui-miniprogram/03-component-mapping.md#视频',
    });
    expect(output).toMatchInlineSnapshot(`
      "arkmp E1023 [pages/Index.ets:24:9]
        不支持的组件：Video（小程序端请使用 ArkMP 的 <Video> 适配组件）
        帮助：见 docs/arkui-miniprogram/03-component-mapping.md#视频"
    `);
  });

  it('无位置信息时省略 [...] 段', () => {
    const output = formatDiagnostic({
      level: 'warning',
      code: 'E2001',
      message: '样式属性不支持，已降级',
    });
    expect(output).toBe('arkmp E2001\n  样式属性不支持，已降级');
  });

  it('只有文件时输出 [file]，无 column 时省略列号', () => {
    expect(
      formatDiagnostic({ level: 'error', code: 'E1', file: 'a.ets', message: 'm' }),
    ).toBe('arkmp E1 [a.ets]\n  m');
    expect(
      formatDiagnostic({ level: 'error', code: 'E1', file: 'a.ets', line: 3, message: 'm' }),
    ).toBe('arkmp E1 [a.ets:3]\n  m');
  });

  it('无帮助信息时省略帮助行；多行 message 逐行缩进', () => {
    const output = formatDiagnostic({
      level: 'error',
      code: 'E1',
      message: '第一行\n第二行',
    });
    expect(output).toBe('arkmp E1\n  第一行\n  第二行');
  });
});

describe('DiagnosticCollector', () => {
  it('add 支持单条与数组', () => {
    const collector = new DiagnosticCollector();
    collector.add(errorDiagnostic('E1', 'a'));
    collector.add([warningDiagnostic('W1', 'b'), errorDiagnostic('E2', 'c')]);
    expect(collector.diagnostics).toHaveLength(3);
  });

  it('hasErrors 只对 error 级响应', () => {
    const collector = new DiagnosticCollector();
    collector.add(warningDiagnostic('W1', 'b'));
    expect(collector.hasErrors()).toBe(false);
    collector.add(errorDiagnostic('E1', 'a'));
    expect(collector.hasErrors()).toBe(true);
    expect(collector.errors()).toHaveLength(1);
    expect(collector.warnings()).toHaveLength(1);
  });

  it('merge 合并另一个收集器', () => {
    const a = new DiagnosticCollector();
    a.add(errorDiagnostic('E1', 'a'));
    const b = new DiagnosticCollector();
    b.add(warningDiagnostic('W1', 'b'));
    a.merge(b);
    expect(a.diagnostics).toHaveLength(2);
    expect(b.diagnostics).toHaveLength(1);
  });

  it('format 汇总输出全部诊断', () => {
    const collector = new DiagnosticCollector();
    collector.add(errorDiagnostic('E1', 'err', { file: 'a.ets', line: 1 }));
    collector.add(warningDiagnostic('W1', 'warn'));
    expect(collector.format()).toBe('arkmp E1 [a.ets:1]\n  err\narkmp W1\n  warn');
  });
});
