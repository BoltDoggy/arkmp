import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compile } from '../src/index';
import type { CompileResult } from '../src/index';

/** README 末尾的 Index.ets 端到端 fixture。 */
const indexEts = readFileSync(new URL('./fixtures/index-page/index.ets', import.meta.url), 'utf8');

function byPath(result: CompileResult): Map<string, string> {
  return new Map(result.files.map((f) => [f.path, f.content]));
}

/** 把全部产物拼成一段文本做整体快照。 */
function snapshotFiles(result: CompileResult): string {
  return result.files.map((f) => `=== ${f.path} ===\n${f.content}`).join('\n');
}

describe('端到端：README 的 Index.ets', () => {
  it('产出四件套且无诊断', () => {
    const result = compile(indexEts, { fileName: 'index.ets' });
    expect(result.diagnostics).toEqual([]);
    expect(result.hasErrors).toBe(false);
    expect(result.model.name).toBe('Index');
    expect(result.model.isEntry).toBe(true);
    expect(result.files.map((f) => f.path)).toEqual([
      'index.wxml',
      'index.wxss',
      'index.js',
      'index.json',
    ]);
    expect(snapshotFiles(result)).toMatchSnapshot();
  });

  it('classMap/inlineStyles 已合并进 wxml，wxss 含 BASE_WXSS 且页面类不重复', () => {
    const files = byPath(compile(indexEts));
    const wxml = files.get('index.wxml') ?? '';
    // fontSize(20) → 页面类 arkmp-n1 落到 Text 节点 class 上
    expect(wxml).toMatch(/<text class="arkmp-n\d+">点击次数：\{\{count\}\}<\/text>/);
    // 事件绑定保留
    expect(wxml).toMatch(/bindtap="__n\d+_click"/);
    const wxss = files.get('index.wxss') ?? '';
    expect(wxss).toContain('.arkmp-col{display:flex;flex-direction:column;box-sizing:border-box;}');
    expect(wxss).toContain('font-size: 40rpx;');
  });

  it('sourcemap: true → 追加 index.js.map，sources 指回 index.ets', () => {
    const result = compile(indexEts, { sourcemap: true });
    const files = byPath(result);
    expect(result.files.map((f) => f.path)).toContain('index.js.map');
    const map = JSON.parse(files.get('index.js.map') ?? '') as Record<string, unknown>;
    expect(map.version).toBe(3);
    expect(map.sources).toEqual(['index.ets']);
    expect(map.sourcesContent).toEqual([indexEts]);
    expect(files.get('index.js')).toContain('//# sourceMappingURL=index.js.map');
  });
});

describe('@Component（非 @Entry）', () => {
  const source = `@Component
struct Child {
  @Prop title: string = '默认';

  build() {
    Text(this.title).fontSize(16)
  }
}
`;

  it('createComponent + json { component: true }', () => {
    const result = compile(source, { fileName: 'child.ets' });
    expect(result.diagnostics).toEqual([]);
    expect(result.model.isEntry).toBe(false);
    const files = byPath(result);
    expect(result.files.map((f) => f.path)).toEqual([
      'child.wxml',
      'child.wxss',
      'child.js',
      'child.json',
    ]);
    expect(files.get('child.js')).toContain('createComponent({');
    expect(files.get('child.js')).toContain('title: { type: String, value: "默认" },');
    expect(files.get('child.json')).toBe('{\n  "component": true\n}\n');
    expect(snapshotFiles(result)).toMatchSnapshot();
  });

  it('isPage 选项可强制按页面产物生成', () => {
    const result = compile(source, { isPage: true });
    expect(byPath(result).get('index.js')).toContain('createPage({');
  });
});

describe('if / ForEach 控制流', () => {
  const source = `@Component
struct TodoView {
  @State showDone: boolean = false;
  @State todos: string[] = ['a', 'b'];

  build() {
    Column() {
      if (this.showDone) {
        Text('已完成')
      } else {
        Text('未完成')
      }
      ForEach(this.todos, (item: string, index: number) => {
        Text(item)
      })
    }
  }
}
`;

  it('wx:if/wx:else + wx:for，key 回退 warning 带 file', () => {
    const result = compile(source);
    expect(result.hasErrors).toBe(false);
    const wxml = byPath(result).get('index.wxml') ?? '';
    expect(wxml).toContain('<block wx:if="{{showDone}}">');
    expect(wxml).toContain('<block wx:else>');
    expect(wxml).toContain('wx:for="{{todos}}"');
    expect(wxml).toContain('wx:for-item="item"');
    expect(wxml).toContain('wx:for-index="index"');
    // ForEach key 回退 warning：全阶段汇总并补上 file
    const warnings = result.diagnostics.filter((d) => d.level === 'warning');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ code: 'W3002', file: 'index.ets' });
    expect(snapshotFiles(result)).toMatchSnapshot();
  });
});

describe('@Link 双向绑定', () => {
  const source = `@Component
struct Counter {
  @Link count: number;

  build() {
    Button('加一').onClick(() => { this.count++; })
  }
}
`;

  it('properties + __set_count 桥接 + 事件方法改写为 __set', () => {
    const result = compile(source);
    expect(result.diagnostics).toEqual([]);
    const js = byPath(result).get('index.js') ?? '';
    expect(js).toContain('count: Number,');
    expect(js).toContain('__set_count(v) {');
    expect(js).toContain("this.triggerEvent('update:count', v);");
    expect(js).toMatch(/__n\d+_click\(\) \{\n\s+this\.__set_count\(this\.count \+ 1\);/);
    expect(snapshotFiles(result)).toMatchSnapshot();
  });
});

describe('配置项', () => {
  const source = `@Component
struct Styled {
  build() {
    Text('hi').fontSize(20).width(100)
  }
}
`;

  it('unitRatio 控制 vp→rpx 换算', () => {
    const wxss = byPath(compile(source, { unitRatio: 3 })).get('index.wxss') ?? '';
    expect(wxss).toContain('font-size: 60rpx;');
    expect(wxss).toContain('width: 300rpx;');
  });

  it('classPrefix 控制页面类名前缀（wxss 与 wxml 一致）', () => {
    const result = compile(source, { classPrefix: 'x-' });
    const files = byPath(result);
    expect(files.get('index.wxss')).toMatch(/\.x-n\d+ \{/);
    expect(files.get('index.wxml')).toMatch(/class="x-n\d+"/);
  });
});

describe('诊断汇总', () => {
  it('error 级诊断：仍返回部分产物，hasErrors 为 true', () => {
    const source = `@Entry
@Component
struct Bad {
  build() {
    Column() {
      Navigation() {
        Text('x')
      }
    }
  }
}
`;
    const result = compile(source);
    expect(result.hasErrors).toBe(true);
    const error = result.diagnostics.find((d) => d.level === 'error');
    expect(error).toMatchObject({ code: 'E3001', file: 'index.ets' });
    // 部分产物仍返回（wxml 中含 unsupported 注释占位）
    expect(result.files).toHaveLength(4);
    expect(byPath(result).get('index.wxml')).toContain('<!-- arkmp: unsupported Navigation -->');
  });

  it('analyzer 诊断行列经 positionMap 回溯到原始源码', () => {
    // @Foo 与 struct 同行：struct→class 预处理缩短 1 列，未回溯会差 1 列
    const source = "struct Index { @Foo\n  @State count: number = 0;\n  build() { Text('x') }\n}\n";
    const result = compile(source);
    const error = result.diagnostics.find((d) => d.code === 'E1101');
    expect(error).toBeDefined();
    expect(error).toMatchObject({ file: 'index.ets', line: 1 });
    // 原始源码中 '@Foo' 的 1 起始列
    expect(error?.column).toBe(source.indexOf('@Foo') + 1);
  });

  it('语法错误不抛异常，返回 error 诊断', () => {
    const result = compile('@Entry\nstruct {\n');
    expect(result.hasErrors).toBe(true);
    expect(result.diagnostics.some((d) => d.code === 'E1006')).toBe(true);
    expect(result.files).toHaveLength(4);
  });
});
