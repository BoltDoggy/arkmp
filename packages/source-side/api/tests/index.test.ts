import { describe, expect, it } from 'vitest';

import {
  apiMappings,
  getApiMapping,
  http,
  listApiMappings,
  routerMappings,
  systemMappings,
  unsupportedMappings,
} from '../src/index.js';

/** 06 篇"系统 API 映射"表列出的全部源码侧 API（14 条） */
const DOC06_SYSTEM_APIS = [
  'http.request',
  'storage.set',
  'storage.get',
  'storage.remove',
  'prompt.showToast',
  'prompt.showDialog',
  'prompt.showActionMenu',
  'media.pickImage',
  'media.previewImage',
  'location.getCurrent',
  'share.share',
  'auth.login',
  'device.getNetworkType',
  'pay.request',
] as const;

/** 06 篇"路由适配"表列出的全部源码侧 API（router.pop 见"回传数据"要点） */
const DOC06_ROUTER_APIS = [
  'router.push',
  'router.replace',
  'router.back',
  'router.pop',
  'router.switchTab',
  'router.relaunch',
] as const;

describe('映射表完整性', () => {
  it('source 无重复', () => {
    const sources = apiMappings.map((entry) => entry.source);
    expect(new Set(sources).size).toBe(sources.length);
  });

  it('每条必需字段齐全（source/signature/adapter/category/note）', () => {
    for (const entry of apiMappings) {
      expect(entry.source).toBeTruthy();
      expect(entry.signature).toContain(entry.source);
      expect(['direct', 'wrap', 'unsupported']).toContain(entry.adapter);
      expect(['router', 'system']).toContain(entry.category);
      expect(entry.note).toBeTruthy();
    }
  });

  it('每条要么有产物目标，要么有降级诊断说明', () => {
    for (const entry of apiMappings) {
      const hasTarget = entry.target !== null && entry.target.length > 0;
      const hasFallback = entry.fallback !== undefined && entry.fallback.length > 0;
      expect(hasTarget || hasFallback, `${entry.source} 缺少目标与降级说明`).toBe(true);
    }
  });

  it("adapter 为 'unsupported' 时必须有 fallback 且 target 为 null", () => {
    for (const entry of apiMappings) {
      if (entry.adapter === 'unsupported') {
        expect(entry.target, entry.source).toBeNull();
        expect(entry.fallback, entry.source).toBeTruthy();
      }
    }
  });

  it('target 为 wx.* 或明确的编译产物配置名', () => {
    for (const entry of apiMappings) {
      if (entry.target !== null) {
        expect(entry.target).toMatch(/^(wx\.|onShareAppMessage|eventChannel\.)/);
      }
    }
  });
});

describe('06 篇覆盖', () => {
  it('系统 API 映射全覆盖', () => {
    const covered = new Set(systemMappings.map((entry) => entry.source));
    for (const api of DOC06_SYSTEM_APIS) {
      expect(covered.has(api), `缺少 ${api} 的映射`).toBe(true);
    }
    expect(systemMappings).toHaveLength(DOC06_SYSTEM_APIS.length);
  });

  it('路由适配映射全覆盖', () => {
    const covered = new Set(routerMappings.map((entry) => entry.source));
    for (const api of DOC06_ROUTER_APIS) {
      expect(covered.has(api), `缺少 ${api} 的映射`).toBe(true);
    }
    expect(routerMappings).toHaveLength(DOC06_ROUTER_APIS.length);
  });

  it('路由目标与 06 篇表格一致', () => {
    expect(getApiMapping('router.push')?.target).toBe('wx.navigateTo');
    expect(getApiMapping('router.replace')?.target).toBe('wx.redirectTo');
    expect(getApiMapping('router.back')?.target).toBe('wx.navigateBack');
    expect(getApiMapping('router.switchTab')?.target).toBe('wx.switchTab');
    expect(getApiMapping('router.relaunch')?.target).toBe('wx.reLaunch');
  });

  it('系统 API 目标与 06 篇表格一致', () => {
    expect(getApiMapping('http.request')?.target).toBe('wx.request');
    expect(getApiMapping('storage.set')?.target).toBe('wx.setStorageSync');
    expect(getApiMapping('prompt.showToast')?.target).toBe('wx.showToast');
    expect(getApiMapping('prompt.showDialog')?.target).toBe('wx.showModal');
    expect(getApiMapping('prompt.showActionMenu')?.target).toBe('wx.showActionSheet');
    expect(getApiMapping('media.pickImage')?.target).toBe('wx.chooseMedia');
    expect(getApiMapping('location.getCurrent')?.target).toBe('wx.getLocation');
    expect(getApiMapping('auth.login')?.target).toBe('wx.login');
    expect(getApiMapping('device.getNetworkType')?.target).toBe('wx.getNetworkType');
    expect(getApiMapping('pay.request')?.target).toBe('wx.requestPayment');
  });

  it('平台能力缺失条目带 E3xxx 降级建议', () => {
    expect(unsupportedMappings.length).toBeGreaterThan(0);
    for (const entry of unsupportedMappings) {
      expect(entry.adapter).toBe('unsupported');
      expect(entry.fallback).toMatch(/^E3\d{3}/);
    }
  });
});

describe('访问函数', () => {
  it('getApiMapping 命中与未命中', () => {
    expect(getApiMapping('http.request')?.signature).toContain('http.request');
    expect(getApiMapping('not.exist')).toBeUndefined();
  });

  it('listApiMappings 类别过滤', () => {
    expect(listApiMappings()).toHaveLength(apiMappings.length);
    expect(listApiMappings('router').every((entry) => entry.category === 'router')).toBe(true);
    expect(listApiMappings('system').every((entry) => entry.category === 'system')).toBe(true);
    expect(listApiMappings('router').length + listApiMappings('system').length).toBe(
      apiMappings.length,
    );
  });
});

describe('源码侧命名空间', () => {
  it('命名空间方法为编译期占位，直接运行抛出明确错误', () => {
    expect(() => http.request('https://example.com')).toThrowError(/http\.request/);
  });
});
