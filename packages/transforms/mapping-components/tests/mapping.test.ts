import { describe, expect, it } from 'vitest';
import {
  COMPONENT_MAPPINGS,
  COMPONENT_MAPPING_MAP,
  EVENT_MAPPING,
  GESTURE_EVENT_MAPPING,
  IMAGE_FIT_MODE_MAP,
  getComponentMapping,
  resolveEventMapping,
} from '../src/index';

describe('组件映射表完整性', () => {
  it('无重复键', () => {
    const names = COMPONENT_MAPPINGS.map((m) => m.arkui);
    expect(new Set(names).size).toBe(names.length);
    expect(COMPONENT_MAPPING_MAP.size).toBe(names.length);
  });

  it('覆盖 03 篇全部组件（含 unsupported）', () => {
    const expected = [
      // 布局容器
      'Column',
      'Row',
      'Stack',
      'Flex',
      'Scroll',
      'List',
      'Grid',
      'Swiper',
      // 基础组件
      'Text',
      'Image',
      'Button',
      'TextInput',
      'TextArea',
      'Toggle',
      'Checkbox',
      'Radio',
      'Slider',
      'Progress',
      'LoadingProgress',
      'Divider',
      'Blank',
      'Badge',
      'Tabs',
      'TabContent',
      'Web',
      'Video',
      'Canvas',
      // 暂不支持
      'Navigation',
      'NavDestination',
      'Refresh',
      'WaterFlow',
      'RelativeContainer',
    ];
    expect([...COMPONENT_MAPPING_MAP.keys()].sort()).toEqual(expected.sort());
  });

  it('mapped/runtime 条目必填 tag', () => {
    for (const m of COMPONENT_MAPPINGS) {
      if (m.support !== 'unsupported') {
        expect(m.tag, m.arkui).toBeTruthy();
      }
    }
  });

  it('unsupported 条目带替代建议', () => {
    const unsupported = COMPONENT_MAPPINGS.filter((m) => m.support === 'unsupported');
    expect(unsupported.length).toBeGreaterThan(0);
    for (const m of unsupported) {
      expect(m.alternative, m.arkui).toBeTruthy();
    }
  });

  it('style 参数规则带目标 CSS 属性名', () => {
    for (const m of COMPONENT_MAPPINGS) {
      for (const p of m.params ?? []) {
        if (p.target !== 'text') {
          expect(p.name, `${m.arkui} ${String(p.arg)}`).toBeTruthy();
        }
      }
    }
  });

  it('eventOverrides 字段齐全', () => {
    for (const m of COMPONENT_MAPPINGS) {
      for (const [event, em] of Object.entries(m.eventOverrides ?? {})) {
        expect(em.bind, `${m.arkui}.${event}`).toMatch(/^bind/);
        expect(em.suffix).toBeTruthy();
      }
    }
  });
});

describe('辅助表', () => {
  it('ImageFit → mode 覆盖 03 篇四种取值', () => {
    expect(IMAGE_FIT_MODE_MAP).toEqual({
      Fill: 'scaleToFill',
      Contain: 'aspectFit',
      Cover: 'aspectFill',
      None: 'center',
    });
  });

  it('全局事件表覆盖 03 篇事件绑定', () => {
    expect(EVENT_MAPPING.onClick).toMatchObject({ bind: 'bindtap', suffix: 'click' });
    expect(EVENT_MAPPING.onChange).toMatchObject({ bind: 'bindchange' });
    expect(EVENT_MAPPING.onTouch).toMatchObject({ bind: 'bindtouchstart' });
    expect(GESTURE_EVENT_MAPPING.TapGesture.bind).toBe('bindtap');
    expect(GESTURE_EVENT_MAPPING.LongPressGesture.bind).toBe('bindlongpress');
  });

  it('resolveEventMapping：组件级覆盖优先', () => {
    const textInput = getComponentMapping('TextInput');
    expect(resolveEventMapping(textInput, 'onChange')?.bind).toBe('bindinput');
    expect(resolveEventMapping(textInput, 'onClick')?.bind).toBe('bindtap');
    expect(resolveEventMapping(undefined, 'onClick')?.bind).toBe('bindtap');
    expect(resolveEventMapping(textInput, 'onHover')).toBeUndefined();
  });
});
