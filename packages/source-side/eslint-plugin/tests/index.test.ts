import { describe, expect, it } from 'vitest';

import plugin, { configs, recommendedRules, rules } from '../src/index.js';

describe('插件导出', () => {
  it('default 导出含 meta/rules/configs', () => {
    expect(plugin.meta.name).toBe('@arkmp/eslint-plugin');
    expect(Object.keys(plugin.rules)).toHaveLength(14);
    expect(plugin.configs).toBe(configs);
  });

  it('recommended 配置覆盖全部规则且自引用插件', () => {
    const recommended = configs.recommended as {
      plugins: Record<string, unknown>;
      rules: Record<string, string>;
    };
    expect(recommended.plugins.arkmp).toBe(plugin);
    expect(Object.keys(recommendedRules)).toHaveLength(Object.keys(rules).length);
    for (const name of Object.keys(rules)) {
      expect(recommendedRules).toHaveProperty(`arkmp/${name}`);
    }
  });

  it('W 级规则（降级提示）与风格建议规则在 recommended 中为 warn，其余为 error', () => {
    const warnRules = new Set([
      'arkmp/no-dynamic-this-access',
      'arkmp/no-degraded-capability',
      'arkmp/no-var',
    ]);
    expect(recommendedRules['arkmp/no-dynamic-this-access']).toBe('warn');
    expect(recommendedRules['arkmp/no-degraded-capability']).toBe('warn');
    expect(recommendedRules['arkmp/no-var']).toBe('warn');
    for (const [name, level] of Object.entries(recommendedRules)) {
      if (warnRules.has(name)) {
        expect(level, name).toBe('warn');
      } else {
        expect(level, name).toBe('error');
      }
    }
  });

  it('每条规则都有规范的 meta（type/docs/messages/schema）', () => {
    for (const [name, rule] of Object.entries(rules)) {
      expect(rule.meta.type, name).toBeTruthy();
      expect(rule.meta.docs?.description, name).toBeTruthy();
      expect(Object.keys(rule.meta.messages).length, name).toBeGreaterThan(0);
      expect(rule.meta.schema, name).toBeDefined();
    }
  });
});
