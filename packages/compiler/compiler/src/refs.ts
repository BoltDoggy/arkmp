/**
 * 自定义组件引用提取与提供方定位（02 篇⑥「组件依赖图」的数据来源）。
 *
 * - 提取：遍历 ComponentModel 的 buildTree 与全部 @Builder 树，组件名不在
 *   @arkmp/mapping-components 映射表内且大写开头的，即自定义组件引用
 *   （与 transform-wxml 判定自定义组件的规则一致）；
 * - 定位：按命名约定 `UserCard` → `components/UserCard.ets`，其次 pages/ 下
 *   同名文件（页面内相对引用）；找不到时由调用方发 W6002 warning。
 */

import type { ComponentModel } from '@arkmp/ir';
import { walkModelTrees } from '@arkmp/ir';
import { getComponentMapping } from '@arkmp/mapping-components';

/** 提取 model 中引用的全部自定义组件名（去重，排序）。 */
export function collectCustomComponentRefs(model: ComponentModel): string[] {
  const refs = new Set<string>();
  walkModelTrees(model, (node) => {
    if (node.type !== 'component') return;
    if (!/^[A-Z]/u.test(node.component)) return;
    if (getComponentMapping(node.component) !== undefined) return;
    refs.add(node.component);
  });
  return [...refs].sort();
}

/**
 * 组件名 → 提供方文件（src 相对 posix 路径）的索引。
 * 以文件基名（去 .ets）为键；components/ 下的文件优先于 pages/ 下的同名文件。
 */
export function buildProviderIndex(sourceFiles: readonly string[]): ReadonlyMap<string, string> {
  const pagesProviders = new Map<string, string>();
  const componentProviders = new Map<string, string>();
  for (const file of sourceFiles) {
    const base = file.split('/').pop() as string;
    const name = base.replace(/\.ets$/u, '');
    if (file.startsWith('components/')) {
      if (!componentProviders.has(name)) componentProviders.set(name, file);
    } else if (file.startsWith('pages/')) {
      if (!pagesProviders.has(name)) pagesProviders.set(name, file);
    }
  }
  return new Map([...pagesProviders, ...componentProviders]);
}
