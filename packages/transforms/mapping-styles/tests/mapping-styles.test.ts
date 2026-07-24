import { describe, expect, it } from 'vitest';
import {
  CROSS_ALIGN_MAP,
  DEFAULT_UNIT_RATIO,
  FLEX_ALIGN_MAP,
  STYLE_WHITELIST,
  STYLE_WHITELIST_MAP,
  convertUnit,
  enumTail,
  getStyleMapping,
  resolveEnum,
} from '../src/index';

describe('白名单完整性', () => {
  it('无重复键', () => {
    const names = STYLE_WHITELIST.map((e) => e.name);
    expect(new Set(names).size).toBe(names.length);
    expect(STYLE_WHITELIST_MAP.size).toBe(names.length);
  });

  it('覆盖 04 篇白名单全部修饰符', () => {
    const expected = [
      'width',
      'height',
      'constraintSize',
      'padding',
      'margin',
      'backgroundColor',
      'backgroundImage',
      'borderRadius',
      'border',
      'fontSize',
      'fontColor',
      'fontWeight',
      'fontStyle',
      'textAlign',
      'maxLines',
      'textOverflow',
      'opacity',
      'visibility',
      'zIndex',
      'position',
      'offset',
      'scale',
      'rotate',
      'shadow',
      'linearGradient',
      'aspectRatio',
      'layoutWeight',
      'align',
      // 布局属性
      'justifyContent',
      'alignItems',
    ];
    for (const name of expected) {
      expect(STYLE_WHITELIST_MAP.has(name), name).toBe(true);
    }
  });

  it('必需字段齐全：direct 类带 css，enum 带 enumMap', () => {
    for (const e of STYLE_WHITELIST) {
      expect(e.name).toBeTruthy();
      expect(e.value).toBeTruthy();
      if (e.value !== 'special') {
        expect(e.css, e.name).toBeTruthy();
      }
      if (e.value === 'enum') {
        expect(e.enumMap, e.name).toBeTruthy();
      }
    }
  });

  it('白名单外修饰符查询返回 undefined（走降级路径）', () => {
    expect(getStyleMapping('blur')).toBeUndefined();
    expect(getStyleMapping('width')).toBeTruthy();
  });
});

describe('枚举映射', () => {
  it('enumTail 取末段', () => {
    expect(enumTail('FlexAlign.SpaceBetween')).toBe('SpaceBetween');
    expect(enumTail('SpaceBetween')).toBe('SpaceBetween');
  });

  it('resolveEnum 命中与未命中', () => {
    expect(resolveEnum(FLEX_ALIGN_MAP, 'FlexAlign.SpaceBetween')).toBe('space-between');
    expect(resolveEnum(CROSS_ALIGN_MAP, 'VerticalAlign.Center')).toBe('center');
    expect(resolveEnum(FLEX_ALIGN_MAP, 'FlexAlign.Unknown')).toBeUndefined();
  });
});

describe('convertUnit 换算边界', () => {
  it('默认系数 ×2', () => {
    expect(DEFAULT_UNIT_RATIO).toBe(2);
    expect(convertUnit(100)).toBe('200rpx');
    expect(convertUnit(16)).toBe('32rpx');
    expect(convertUnit(12)).toBe('24rpx');
  });

  it('可配置系数', () => {
    expect(convertUnit(100, 1.5)).toBe('150rpx');
    expect(convertUnit(10, 1)).toBe('10rpx');
  });

  it('零值不带单位', () => {
    expect(convertUnit(0)).toBe('0');
    expect(convertUnit(0, 3)).toBe('0');
  });

  it('负数与小数', () => {
    expect(convertUnit(-5)).toBe('-10rpx');
    expect(convertUnit(0.5)).toBe('1rpx');
    expect(convertUnit(0.15)).toBe('0.3rpx');
  });

  it('百分比与带单位字符串透传', () => {
    expect(convertUnit('100%')).toBe('100%');
    expect(convertUnit('12px')).toBe('12px');
    expect(convertUnit('50vw')).toBe('50vw');
  });

  it('纯数字字符串按数值换算', () => {
    expect(convertUnit('20')).toBe('40rpx');
  });
});
