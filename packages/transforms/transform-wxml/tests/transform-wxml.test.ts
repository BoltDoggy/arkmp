import { describe, expect, it } from 'vitest';
import type { Expression, StyleCall, UIChildNode, UINode } from '@arkmp/ir';
import { WXML_DIAGNOSTIC_CODES, expressionText, transformWxml } from '../src/index';

// ── IR 构造辅助（内联构造 IR，保持测试自洽） ──

const st = (value: unknown): Expression => ({ kind: 'static', value });
const bd = (path: string, template?: string): Expression => ({ kind: 'binding', path, template });
const obj = (properties: Record<string, Expression>): Expression => ({ kind: 'object', properties });

interface NodeInit {
  params?: Expression[];
  children?: UIChildNode[];
  styleCalls?: StyleCall[];
  eventCalls?: UINode['eventCalls'];
}

function ui(id: string, component: string, init: NodeInit = {}): UINode {
  return {
    type: 'component',
    id,
    component,
    params: init.params ?? [],
    children: init.children ?? [],
    styleCalls: init.styleCalls ?? [],
    eventCalls: init.eventCalls ?? [],
  };
}

/** 以 Column 根包裹子树，模拟 buildTree。 */
function root(...children: UIChildNode[]): UINode {
  return ui('n0', 'Column', { children });
}

describe('布局容器（03 篇「映射为 view + 基础类」）', () => {
  it('Column({ space }) → view.arkmp-col + gap', () => {
    const tree = ui('n0', 'Column', {
      params: [st({ space: 12 })],
      children: [ui('n1', 'Text', { params: [st('标题')] })],
    });
    const { wxml, diagnostics } = transformWxml(tree);
    expect(diagnostics).toEqual([]);
    expect(wxml).toMatchSnapshot();
  });

  it('Row / Stack / Flex / Scroll / List / Grid / Swiper', () => {
    const tree = root(
      ui('n1', 'Row', { children: [ui('n2', 'Text', { params: [st('a')] })] }),
      ui('n3', 'Stack'),
      ui('n4', 'Flex', { params: [st({ wrap: 'Wrap' })] }),
      ui('n5', 'Scroll', { children: [ui('n6', 'Text', { params: [st('b')] })] }),
      ui('n7', 'List'),
      ui('n8', 'Grid'),
      ui('n9', 'Swiper'),
    );
    const { wxml, diagnostics } = transformWxml(tree);
    expect(diagnostics).toEqual([]);
    expect(wxml).toMatchSnapshot();
  });
});

describe('基础组件映射（03 篇「基础组件映射表」）', () => {
  it('Text 静态文本 / Divider / Blank', () => {
    const tree = root(
      ui('n1', 'Text', { params: [st('内容')] }),
      ui('n2', 'Divider'),
      ui('n3', 'Blank'),
    );
    expect(transformWxml(tree).wxml).toMatchSnapshot();
  });

  it('Image：src + objectFit → mode', () => {
    const tree = root(
      ui('n1', 'Image', {
        params: [st('app.media.avatar')],
        styleCalls: [{ name: 'objectFit', args: [st('ImageFit.Cover')] }],
      }),
      ui('n2', 'Image', { params: [bd('avatar')] }),
    );
    expect(transformWxml(tree).wxml).toMatchSnapshot();
  });

  it('Button 纯文本 → view.arkmp-btn + bindtap', () => {
    const tree = root(
      ui('n7', 'Button', {
        params: [st('确定')],
        eventCalls: [{ name: 'onClick', body: 'this.submit();' }],
      }),
    );
    const { wxml, diagnostics } = transformWxml(tree);
    expect(diagnostics).toEqual([]);
    expect(wxml).toMatchSnapshot();
    expect(wxml).toContain('bindtap="__n7_click"');
  });

  it('TextInput：placeholder + onChange → bindinput', () => {
    const tree = root(
      ui('n4', 'TextInput', {
        params: [st({ placeholder: '请输入' })],
        eventCalls: [{ name: 'onChange', body: 'this.onInput();' }],
      }),
      ui('n5', 'Toggle', {
        eventCalls: [{ name: 'onChange', body: 'this.onToggle();' }],
      }),
    );
    const { wxml } = transformWxml(tree);
    expect(wxml).toContain('bindinput="__n4_change"');
    expect(wxml).toContain('bindchange="__n5_change"');
    expect(wxml).toMatchSnapshot();
  });

  it('Canvas：canvas-id 由节点 id 分配', () => {
    const { wxml } = transformWxml(root(ui('n3', 'Canvas')));
    expect(wxml).toContain('canvas-id="canvas-n3"');
  });

  it('onTouch → bindtouchstart/move/end 分发', () => {
    const tree = root(
      ui('n6', 'Text', {
        params: [st('拖动')],
        eventCalls: [{ name: 'onTouch', body: 'this.track();' }],
      }),
    );
    const { wxml } = transformWxml(tree);
    expect(wxml).toContain('bindtouchstart="__n6_touch"');
    expect(wxml).toContain('bindtouchmove="__n6_touch"');
    expect(wxml).toContain('bindtouchend="__n6_touch"');
  });

  it('未收录事件 → W3001 warning 并跳过', () => {
    const tree = root(
      ui('n1', 'Text', {
        params: [st('x')],
        eventCalls: [{ name: 'onHover', body: '' }],
      }),
    );
    const { diagnostics } = transformWxml(tree);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({
      level: 'warning',
      code: WXML_DIAGNOSTIC_CODES.UNKNOWN_EVENT,
    });
  });
});

describe('控制流翻译（03 篇）', () => {
  it('if / else → wx:if / wx:else', () => {
    const tree = root({
      type: 'if',
      id: 'n1',
      condition: bd('isLoading'),
      children: [ui('n2', 'LoadingProgress')],
      elseChildren: [ui('n3', 'Text', { params: [st('加载完成')] })],
    });
    const { wxml, diagnostics } = transformWxml(tree);
    expect(diagnostics).toEqual([]);
    expect(wxml).toMatchSnapshot();
  });

  it('else-if 链 → wx:elif', () => {
    const tree = root({
      type: 'if',
      id: 'n1',
      condition: bd('tab', '${0} === 0'),
      children: [ui('n2', 'Text', { params: [st('首页')] })],
      elseChildren: [
        {
          type: 'if',
          id: 'n3',
          condition: bd('tab', '${0} === 1'),
          children: [ui('n4', 'Text', { params: [st('我的')] })],
          elseChildren: [ui('n5', 'Text', { params: [st('其他')] })],
        },
      ],
    });
    const { wxml } = transformWxml(tree);
    expect(wxml).toContain('wx:elif');
    expect(wxml).toContain('wx:else');
    expect(wxml).toMatchSnapshot();
  });

  it('ForEach → wx:for（item/index 命名 + wx:key 回退 warning）', () => {
    const tree = root({
      type: 'foreach',
      id: 'n1',
      items: bd('items'),
      itemName: 'item',
      indexName: 'index',
      children: [ui('n2', 'Text', { params: [bd('item.title')] })],
    });
    const { wxml, diagnostics } = transformWxml(tree);
    expect(wxml).toContain('wx:for="{{items}}"');
    expect(wxml).toContain('wx:for-item="item"');
    expect(wxml).toContain('wx:for-index="index"');
    expect(wxml).toContain('wx:key="index"');
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({
      level: 'warning',
      code: WXML_DIAGNOSTIC_CODES.FOREACH_KEY_FALLBACK,
    });
    expect(wxml).toMatchSnapshot();
  });

  it('ForEach 内的事件：元素补 data-* 属性传递循环变量', () => {
    const tree = root({
      type: 'foreach',
      id: 'n1',
      items: bd('list'),
      itemName: 'r',
      children: [
        ui('n2', 'Row', {
          eventCalls: [{ name: 'onClick', body: 'this.goDetail(r.id);' }],
          children: [ui('n3', 'Text', { params: [bd('r.title')] })],
        }),
      ],
    });
    const { wxml } = transformWxml(tree);
    // 有事件的元素上补 data-r="{{r}}"
    expect(wxml).toContain('data-r="{{r}}"');
    expect(wxml).toContain('bindtap="__n2_click"');
    // 无事件的子元素不补 data-*
    const textLine = wxml.split('\n').find((l) => l.includes('<text'));
    expect(textLine).not.toContain('data-');
  });
});

describe('状态绑定表达式（03 篇）', () => {
  it('模板字符串 / 纯路径 / 三元路径', () => {
    const tree = root(
      ui('n1', 'Text', { params: [bd('count', '点击次数：${0}')] }),
      ui('n2', 'Text', { params: [bd('user.name')] }),
      ui('n3', 'Text', { params: [bd("isVip ? '会员' : '游客'")] }),
    );
    const { wxml } = transformWxml(tree);
    expect(wxml).toContain('点击次数：{{count}}');
    expect(wxml).toContain('{{user.name}}');
    expect(wxml).toContain("{{isVip ? '会员' : '游客'}}");
    expect(wxml).toMatchSnapshot();
  });

  it('expressionText：static / binding / template', () => {
    expect(expressionText(st('内容'))).toBe('内容');
    expect(expressionText(st(20))).toBe('20');
    expect(expressionText(bd('count'))).toBe('{{count}}');
    expect(expressionText(bd('count', 'count=${0}!'))).toBe('count={{count}}!');
  });
});

describe('自定义组件引用（03 篇）', () => {
  it('UserCard：静态字符串字面量直写，其余包 {{}}', () => {
    const tree = root(
      ui('n1', 'UserCard', { params: [st({ name: '小明', age: 20 })] }),
    );
    const { wxml, diagnostics } = transformWxml(tree);
    expect(diagnostics).toEqual([]);
    expect(wxml).toContain('<user-card name="小明" age="{{20}}" />');
    expect(wxml).toMatchSnapshot();
  });

  it('StatusTag({ status: this.status }) → status="{{status}}"', () => {
    const tree = root(
      ui('n1', 'StatusTag', { params: [obj({ status: bd('status') })] }),
    );
    const { wxml, diagnostics } = transformWxml(tree);
    expect(diagnostics).toEqual([]);
    expect(wxml).toContain('<status-tag status="{{status}}" />');
  });

  it('混合静态与绑定 props：name 直写，count 包 {{}}', () => {
    const tree = root(
      ui('n1', 'UserCard', {
        params: [obj({ name: st('小明'), count: bd('count') })],
      }),
    );
    const { wxml, diagnostics } = transformWxml(tree);
    expect(diagnostics).toEqual([]);
    expect(wxml).toContain('<user-card name="小明" count="{{count}}" />');
  });
});

describe('不支持的组件（03 篇）', () => {
  it('Navigation → E3001 error + 替代建议', () => {
    const tree = root(ui('n1', 'Navigation'));
    const { wxml, diagnostics } = transformWxml(tree);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({
      level: 'error',
      code: WXML_DIAGNOSTIC_CODES.UNSUPPORTED_COMPONENT,
    });
    expect(diagnostics[0].help).toContain('路由');
    expect(wxml).toContain('<!-- arkmp: unsupported Navigation -->');
    expect(wxml).toMatchSnapshot();
  });

  it('未收录的小写组件 → E3001 error', () => {
    const tree = root(ui('n1', 'someThing'));
    const { diagnostics } = transformWxml(tree);
    expect(diagnostics[0]?.code).toBe(WXML_DIAGNOSTIC_CODES.UNSUPPORTED_COMPONENT);
  });
});

describe('排版', () => {
  it('输出带缩进的可读字符串，支持自定义缩进', () => {
    const tree = ui('n0', 'Row', { children: [ui('n1', 'Text', { params: [st('x')] })] });
    const { wxml } = transformWxml(tree, { indent: '    ' });
    expect(wxml).toBe(
      '<view class="arkmp-row">\n    <text>x</text>\n</view>\n',
    );
  });
});

describe('classMap / inlineStyles 合并（transform-wxss 产物落到 class/style 属性）', () => {
  it('classMap 类名追加在 baseClass 之后', () => {
    const tree = ui('n0', 'Column', { children: [ui('n1', 'Text', { params: [st('x')] })] });
    const { wxml } = transformWxml(tree, {
      classMap: { n0: 'arkmp-n0', n1: 'arkmp-n1' },
    });
    expect(wxml).toContain('<view class="arkmp-col arkmp-n0">');
    expect(wxml).toContain('<text class="arkmp-n1">x</text>');
    expect(wxml).toMatchSnapshot();
  });

  it('classMap 与 baseClass 相同时去重', () => {
    const tree = ui('n0', 'Column');
    const { wxml } = transformWxml(tree, { classMap: { n0: 'arkmp-col' } });
    expect(wxml).toContain('class="arkmp-col"');
  });

  it('inlineStyles 追加在静态 style 声明之后', () => {
    const tree = ui('n0', 'Column', {
      params: [st({ space: 12 })],
      children: [ui('n1', 'Text', { params: [st('x')] })],
    });
    const { wxml } = transformWxml(tree, {
      inlineStyles: { n0: 'width: {{boxWidth}}' },
    });
    expect(wxml).toContain('style="gap: 24rpx; width: {{boxWidth}}"');
    expect(wxml).toMatchSnapshot();
  });

  it('自定义组件同样合并 class / style', () => {
    const tree = root(ui('n1', 'UserCard', { params: [st({ name: '小明' })] }));
    const { wxml } = transformWxml(tree, {
      classMap: { n1: 'arkmp-n1' },
      inlineStyles: { n1: 'color: {{themeColor}}' },
    });
    expect(wxml).toContain(
      '<user-card class="arkmp-n1" name="小明" style="color: {{themeColor}}" />',
    );
  });

  it('未命中 classMap/inlineStyles 的节点不受影响', () => {
    const tree = root(ui('n1', 'Text', { params: [st('x')] }));
    const { wxml } = transformWxml(tree, { classMap: {}, inlineStyles: {} });
    expect(wxml).toContain('<text>x</text>');
  });
});
