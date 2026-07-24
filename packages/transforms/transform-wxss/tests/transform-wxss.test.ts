import { describe, expect, it } from 'vitest';
import type { Expression, StyleCall, UIChildNode, UINode } from '@arkmp/ir';
import { WXSS_DIAGNOSTIC_CODES, transformWxss } from '../src/index';

// ── IR 构造辅助（内联构造 IR，保持测试自洽） ──

const st = (value: unknown): Expression => ({ kind: 'static', value });
const bd = (path: string): Expression => ({ kind: 'binding', path });

function ui(id: string, component: string, styleCalls: StyleCall[], children: UIChildNode[] = []): UINode {
  return { type: 'component', id, component, params: [], children, styleCalls, eventCalls: [] };
}

const root = (...children: UIChildNode[]): UINode => ui('n0', 'Column', [], children);

describe('静态样式 → WXSS 类（04 篇「总体策略」）', () => {
  it('单位换算：width/height/fontSize vp→rpx，百分比透传', () => {
    const tree = root(
      ui('n1', 'Text', [
        { name: 'width', args: [st(100)] },
        { name: 'height', args: [st('100%')] },
        { name: 'fontSize', args: [st(16)] },
      ]),
    );
    const { wxss, classMap, diagnostics } = transformWxss(tree);
    expect(diagnostics).toEqual([]);
    expect(classMap['n1']).toBe('arkmp-n1');
    expect(wxss).toContain('width: 200rpx;');
    expect(wxss).toContain('height: 100%;');
    expect(wxss).toContain('font-size: 32rpx;');
    expect(wxss).toMatchSnapshot();
  });

  it('padding 对象参数展开为四值；border 组合', () => {
    const tree = root(
      ui('n1', 'Text', [
        { name: 'padding', args: [st({ top: 12, left: 16 })] },
        { name: 'border', args: [st({ width: 1, color: '#333' })] },
      ]),
    );
    const { wxss } = transformWxss(tree);
    expect(wxss).toContain('padding: 24rpx 0 0 32rpx;');
    expect(wxss).toContain('border: 2rpx solid #333;');
    expect(wxss).toMatchSnapshot();
  });

  it('unitRatio 可配置', () => {
    const tree = root(ui('n1', 'Text', [{ name: 'width', args: [st(100)] }]));
    const { wxss } = transformWxss(tree, { unitRatio: 1.5 });
    expect(wxss).toContain('width: 150rpx;');
  });

  it('classPrefix 可配置', () => {
    const tree = root(ui('n1', 'Text', [{ name: 'width', args: [st(100)] }]));
    const { wxss, classMap } = transformWxss(tree, { classPrefix: 'index-' });
    expect(classMap['n1']).toBe('index-n1');
    expect(wxss).toContain('.index-n1 {');
  });

  it('重复样式组合去重为一个类', () => {
    const tree = root(
      ui('n1', 'Text', [{ name: 'fontSize', args: [st(16)] }]),
      ui('n2', 'Text', [{ name: 'fontSize', args: [st(16)] }]),
    );
    const { wxss, classMap } = transformWxss(tree);
    expect(classMap['n1']).toBe('arkmp-n1');
    expect(classMap['n2']).toBe('arkmp-n1');
    expect(wxss.match(/\.arkmp-n1 \{/g)).toHaveLength(1);
    expect(wxss).toMatchSnapshot();
  });

  it('无 styleCalls 的节点不产生类', () => {
    const tree = root(ui('n1', 'Text', []));
    const { wxss, classMap, inlineStyles } = transformWxss(tree);
    expect(wxss).toBe('');
    expect(classMap).toEqual({});
    expect(inlineStyles).toEqual({});
  });
});

describe('布局属性（04 篇）', () => {
  it('justifyContent / alignItems 枚举映射', () => {
    const tree = ui(
      'n0',
      'Column',
      [
        { name: 'justifyContent', args: [st('FlexAlign.SpaceBetween')] },
        { name: 'alignItems', args: [st('HorizontalAlign.Center')] },
      ],
      [],
    );
    const { wxss, diagnostics } = transformWxss(tree);
    expect(diagnostics).toEqual([]);
    expect(wxss).toContain('justify-content: space-between;');
    expect(wxss).toContain('align-items: center;');
    expect(wxss).toMatchSnapshot();
  });

  it('layoutWeight 父容器为 Row/Column 合法，否则 warning', () => {
    const ok = transformWxss(
      ui('n0', 'Row', [], [ui('n1', 'Text', [{ name: 'layoutWeight', args: [st(1)] }])]),
    );
    expect(ok.wxss).toContain('flex: 1;');
    expect(ok.diagnostics).toEqual([]);

    const bad = transformWxss(
      ui('n0', 'Stack', [], [ui('n1', 'Text', [{ name: 'layoutWeight', args: [st(1)] }])]),
    );
    expect(bad.diagnostics).toHaveLength(1);
    expect(bad.diagnostics[0]).toMatchObject({
      level: 'warning',
      code: WXSS_DIAGNOSTIC_CODES.LAYOUT_WEIGHT_PARENT,
    });
  });
});

describe('特殊换算（04 篇白名单备注）', () => {
  it('maxLines + textOverflow：单行 / 多行分流', () => {
    const tree = root(
      ui('n1', 'Text', [
        { name: 'maxLines', args: [st(1)] },
        { name: 'textOverflow', args: [st('TextOverflow.Ellipsis')] },
      ]),
      ui('n2', 'Text', [
        { name: 'maxLines', args: [st(3)] },
        { name: 'textOverflow', args: [st('TextOverflow.Ellipsis')] },
      ]),
    );
    const { wxss, diagnostics } = transformWxss(tree);
    expect(diagnostics).toEqual([]);
    expect(wxss).toContain('white-space: nowrap;');
    expect(wxss).toContain('text-overflow: ellipsis;');
    expect(wxss).toContain('-webkit-line-clamp: 3;');
    expect(wxss).toMatchSnapshot();
  });

  it('position / offset / shadow / linearGradient / aspectRatio', () => {
    const tree = root(
      ui('n1', 'Text', [
        { name: 'position', args: [st({ x: 10, y: 20 })] },
        { name: 'offset', args: [st({ x: 5, y: 0 })] },
        { name: 'shadow', args: [st({ radius: 8, color: '#00000033', offsetY: 2 })] },
        {
          name: 'linearGradient',
          args: [st({ angle: 90, colors: [['#fff', 0], ['#000', 1]] })],
        },
        { name: 'aspectRatio', args: [st(1.5)] },
      ]),
    );
    const { wxss, diagnostics } = transformWxss(tree);
    expect(diagnostics).toEqual([]);
    expect(wxss).toContain('position: absolute;');
    expect(wxss).toContain('left: 20rpx;');
    expect(wxss).toContain('transform: translate(10rpx, 0);');
    expect(wxss).toContain('box-shadow: 0 4rpx 16rpx #00000033;');
    expect(wxss).toContain('background: linear-gradient(90deg, #fff 0%, #000 100%);');
    expect(wxss).toContain('aspect-ratio: 1.5;');
    expect(wxss).toMatchSnapshot();
  });

  it('constraintSize 展开为 max-width 等', () => {
    const tree = root(
      ui('n1', 'Text', [{ name: 'constraintSize', args: [st({ maxWidth: 200, minHeight: 40 })] }]),
    );
    const { wxss } = transformWxss(tree);
    expect(wxss).toContain('max-width: 400rpx;');
    expect(wxss).toContain('min-height: 80rpx;');
  });

  it('visibility(Hidden) → hidden；visibility(None) → warning 建议条件渲染', () => {
    const hidden = transformWxss(
      root(ui('n1', 'Text', [{ name: 'visibility', args: [st('Visibility.Hidden')] }])),
    );
    expect(hidden.wxss).toContain('visibility: hidden;');

    const none = transformWxss(
      root(ui('n1', 'Text', [{ name: 'visibility', args: [st('Visibility.None')] }])),
    );
    expect(none.diagnostics).toHaveLength(1);
    expect(none.diagnostics[0]?.code).toBe(WXSS_DIAGNOSTIC_CODES.VISIBILITY_NONE);
  });

  it('fontWeight 数值字面值透传', () => {
    const { wxss } = transformWxss(
      root(ui('n1', 'Text', [{ name: 'fontWeight', args: [st(500)] }])),
    );
    expect(wxss).toContain('font-weight: 500;');
  });

  it('objectFit 由 transform-wxml 消费，不进 WXSS', () => {
    const { wxss, diagnostics } = transformWxss(
      root(ui('n1', 'Image', [{ name: 'objectFit', args: [st('ImageFit.Cover')] }])),
    );
    expect(wxss).toBe('');
    expect(diagnostics).toEqual([]);
  });
});

describe('动态样式与白名单外降级（04 篇）', () => {
  it('动态样式（binding）→ inlineStyles 表', () => {
    const tree = root(
      ui('n1', 'Text', [
        { name: 'width', args: [bd('boxWidth')] },
        { name: 'fontSize', args: [st(16)] },
      ]),
    );
    const { wxss, inlineStyles, classMap, diagnostics } = transformWxss(tree);
    expect(diagnostics).toEqual([]);
    expect(inlineStyles['n1']).toBe('width: {{boxWidth}}');
    // 同节点的静态样式仍提取为类
    expect(classMap['n1']).toBe('arkmp-n1');
    expect(wxss).toContain('font-size: 32rpx;');
    expect(wxss).toMatchSnapshot();
  });

  it('白名单外修饰符 → warning + 类内注释，不阻断构建', () => {
    const tree = root(
      ui('n1', 'Text', [
        { name: 'blur', args: [st(10)] },
        { name: 'width', args: [st(100)] },
      ]),
    );
    const { wxss, diagnostics } = transformWxss(tree);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({
      level: 'warning',
      code: WXSS_DIAGNOSTIC_CODES.UNSUPPORTED_MODIFIER,
    });
    expect(wxss).toContain('/* arkmp: unsupported .blur(10) */');
    expect(wxss).toContain('width: 200rpx;');
    expect(wxss).toMatchSnapshot();
  });

  it('特殊修饰符的动态形式 → W3105 warning 跳过', () => {
    const tree = root(ui('n1', 'Text', [{ name: 'position', args: [bd('pos')] }]));
    const { inlineStyles, diagnostics } = transformWxss(tree);
    expect(inlineStyles).toEqual({});
    expect(diagnostics[0]?.code).toBe(WXSS_DIAGNOSTIC_CODES.DYNAMIC_SPECIAL);
  });
});

describe('类名稳定性', () => {
  it('同一棵树的类名由节点 id 派生，与构建次数无关', () => {
    const build = (): UINode =>
      root(
        ui('n1', 'Text', [{ name: 'width', args: [st(100)] }]),
        {
          type: 'foreach',
          id: 'n2',
          items: bd('items'),
          itemName: 'item',
          children: [ui('n3', 'Text', [{ name: 'fontSize', args: [st(14)] }])],
        },
      );
    const first = transformWxss(build());
    const second = transformWxss(build());
    expect(first.wxss).toBe(second.wxss);
    expect(first.classMap).toEqual({ n1: 'arkmp-n1', n3: 'arkmp-n3' });
    // foreach / if 子节点也会被遍历
    expect(first.wxss).toContain('.arkmp-n3 {');
  });
});
