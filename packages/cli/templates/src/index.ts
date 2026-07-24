/**
 * @arkmp/templates —— L7 `ark-mp init` 脚手架模板（07 篇工程结构）。
 *
 * 模板文件存放于包内 `templates/<name>/` 目录（纯文本，原样拷贝），
 * `renderTemplate` 做变量替换后写入目标目录：
 *
 * - `{{projectName}}` → 工程名（init 的 `<name>` 参数）
 * - `{{appId}}`       → 小程序 appId（缺省用占位符，由用户替换为真实 appId）
 *
 * 内置模板：
 * - `default`：最小工程（arkmp.config.ts + package.json + tsconfig.json +
 *   app.ets + 1 个 @Entry 页面 + 1 个自定义组件）；
 * - `demo`：在 default 基础上增加 detail/mine 示例页面与 tabBar 配置。
 */

import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** 内置模板名。 */
export type TemplateName = 'default' | 'demo';

/** 模板变量。 */
export interface RenderVariables {
  /** 工程名 → `{{projectName}}` */
  projectName: string;
  /** 小程序 appId → `{{appId}}`，缺省为占位符 `wx1234567890abcdef` */
  appId?: string;
}

/** 占位 appId（用户在生成的 arkmp.config.ts 中替换为真实 appId）。 */
export const PLACEHOLDER_APP_ID = 'wx1234567890abcdef';

/** 模板目录（dist 与 src 均位于包根下一级，`../templates` 两种形态都成立）。 */
function templatesRoot(): string {
  return fileURLToPath(new URL('../templates', import.meta.url));
}

/** 列出内置模板名（templates/ 下的子目录）。 */
export function listTemplates(): TemplateName[] {
  return readdirSync(templatesRoot())
    .filter((entry) => statSync(join(templatesRoot(), entry)).isDirectory())
    .sort() as TemplateName[];
}

/** 文本变量替换。 */
function substitute(content: string, vars: Required<RenderVariables>): string {
  return content.split('{{projectName}}').join(vars.projectName).split('{{appId}}').join(vars.appId);
}

/**
 * 将模板渲染到目标目录（目录不存在时创建；已存在的同名文件会被覆盖）。
 * 返回写入的文件（目标目录相对 posix 路径，排序）。
 */
export function renderTemplate(
  name: TemplateName,
  targetDir: string,
  vars: RenderVariables,
): string[] {
  if (!listTemplates().includes(name)) {
    throw new Error(`未知模板：${name}（可选：${listTemplates().join(', ')}）`);
  }
  const resolved: Required<RenderVariables> = {
    projectName: vars.projectName,
    appId: vars.appId ?? PLACEHOLDER_APP_ID,
  };

  const written: string[] = [];
  const walk = (dir: string, rel: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const relPath = rel === '' ? entry : `${rel}/${entry}`;
      if (statSync(full).isDirectory()) {
        walk(full, relPath);
      } else {
        const target = join(targetDir, relPath);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, substitute(readFileSync(full, 'utf8'), resolved));
        written.push(relPath);
      }
    }
  };
  walk(join(templatesRoot(), name), '');
  return written.sort();
}
