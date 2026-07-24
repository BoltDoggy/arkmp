/**
 * 路径与命名约定（docs/arkui-miniprogram/01-overview.md「产物目录约定」、
 * 07-cli.md「源码工程结构」）：
 *
 * ```text
 * src/app.ets                     → dist/app.js / app.json / app.wxss（特殊形态）
 * src/pages/index/Index.ets       → dist/pages/index/index.{wxml,wxss,js,json}
 *                                    （目录/文件名小写化；路由 pages/index/index）
 * src/components/UserCard.ets     → dist/components/user-card/user-card.{...}
 *                                    （kebab-case，与 wxml 标签名一致）
 * src/resources/media/**          → dist/assets/**（保留 media 下的相对结构）
 * ```
 *
 * 缓存/依赖图中的文件键一律为「src 相对 posix 路径（保留原始大小写）」，
 * 如 `pages/index/Index.ets`。
 */

/** UpperCamel → kebab-case（`UserCard` → `user-card`），与 transform-wxml 的标签命名一致。 */
export function kebabCase(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

/** 页面产物基路径（无扩展名）：`pages/index/Index.ets` → `pages/index/index`。 */
export function pageOutputBase(srcRelativePath: string): string {
  return srcRelativePath.replace(/\.ets$/u, '').toLowerCase();
}

/** 组件产物基路径（无扩展名）：`components/UserCard.ets` → `components/user-card/user-card`。 */
export function componentOutputBase(srcRelativePath: string): string {
  const noExt = srcRelativePath.replace(/\.ets$/u, '');
  return noExt
    .split('/')
    .map((segment) => kebabCase(segment))
    .join('/');
}

/** 源文件 → 产物基路径（pages/ 小写化，components/ kebab 化）。 */
export function outputBaseFor(srcRelativePath: string): string {
  return srcRelativePath.startsWith('components/')
    ? componentOutputBase(srcRelativePath)
    : pageOutputBase(srcRelativePath);
}

/**
 * 生成 js 产物中到 `arkmp/runtime.js` 的相对 require 路径。
 * 如产物 `pages/index/index.js` → `../../arkmp/runtime.js`。
 */
export function relativeRuntimeRequire(jsOutputPath: string): string {
  const depth = jsOutputPath.split('/').length - 1;
  const prefix = depth === 0 ? './' : '../'.repeat(depth);
  return `${prefix}arkmp/runtime.js`;
}

/**
 * usingComponents 的组件引用路径：
 * - 提供方在 components/ 下 → 绝对路径 `/components/user-card/user-card`；
 * - 提供方在 pages/ 下（页面内相对引用）→ 相对引用方产物目录的路径（如 `../shared/avatar`）。
 */
export function usingComponentPath(providerSrcPath: string, referrerOutputBase: string): string {
  const providerBase = outputBaseFor(providerSrcPath);
  if (providerBase.startsWith('components/')) {
    return `/${providerBase}`;
  }
  const referrerDir = referrerOutputBase.split('/').slice(0, -1);
  const providerSegments = providerBase.split('/');
  let common = 0;
  while (
    common < referrerDir.length &&
    common < providerSegments.length &&
    referrerDir[common] === providerSegments[common]
  ) {
    common += 1;
  }
  const ups = '../'.repeat(referrerDir.length - common);
  return `${ups}${providerSegments.slice(common).join('/')}` || './';
}
