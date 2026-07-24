/**
 * @arkmp/incremental —— L4 增量编译缓存（docs/arkui-miniprogram/02-pipeline.md ⑥）。
 *
 * 以文件为单位缓存 源码哈希 + ComponentModel，配合 @arkmp/dep-graph 做级联失效：
 *
 * ```text
 * compile 后   update(path, source, model, deps)   登记哈希、model 与依赖边
 * 变更时       invalidate(changedFiles) → 重建集合  变更文件 ∪ dependentsOf 传递闭包
 * 重编前       get(path, source)                   哈希未变 → 命中缓存 model，跳过重编译
 * ```
 *
 * 纯内存结构，无 I/O：文件内容的读取与编译由调用方负责。
 */

import { DepGraph } from '@arkmp/dep-graph';
import type { ComponentModel } from '@arkmp/ir';
import { hashContent } from '@arkmp/shared';

/** 单文件缓存条目。 */
interface CacheEntry {
  /** `hashContent(source)`，变更判定依据 */
  hash: string;
  /** 编译核心 IR（跳过重编译时直接复用） */
  model: ComponentModel;
}

export class IncrementalCache {
  /** 文件级依赖图（级联失效来源）；调用方可通过它补充查询。 */
  readonly graph: DepGraph;
  private readonly entries = new Map<string, CacheEntry>();

  constructor(graph: DepGraph = new DepGraph()) {
    this.graph = graph;
  }

  /**
   * 编译完成后登记文件：源码哈希、ComponentModel 与直接依赖（整体替换旧边）。
   */
  update(path: string, source: string, model: ComponentModel, dependencies: readonly string[] = []): void {
    this.entries.set(path, { hash: hashContent(source), model });
    this.graph.addFile(path, dependencies);
  }

  /**
   * 查询缓存：文件已登记且源码哈希未变时返回缓存的 ComponentModel（跳过重编译）；
   * 否则返回 undefined（调用方应重编译并 update）。
   */
  get(path: string, source: string): ComponentModel | undefined {
    const entry = this.entries.get(path);
    if (entry === undefined) return undefined;
    return entry.hash === hashContent(source) ? entry.model : undefined;
  }

  /** 是否持有该文件的有效缓存（仅判断是否登记过，不校验哈希）。 */
  has(path: string): boolean {
    return this.entries.has(path);
  }

  /**
   * 失效判定：返回需要重建的文件集合（排序去重）——
   * 变更文件本身 ∪ 依赖图中各变更文件的 `dependentsOf` 传递闭包，
   * 并同步清除这些文件的缓存条目（下次 `get` 必不命中）。
   * 未知的变更文件（新增文件）原样包含在结果中。
   */
  invalidate(changedFiles: readonly string[]): string[] {
    const rebuild = new Set<string>();
    for (const file of changedFiles) {
      rebuild.add(file);
      for (const dependent of this.graph.dependentsOf(file)) {
        rebuild.add(dependent);
      }
    }
    for (const file of rebuild) {
      this.entries.delete(file);
    }
    return [...rebuild].sort();
  }

  /** 文件删除：清除缓存条目与依赖图节点。 */
  remove(path: string): void {
    this.entries.delete(path);
    this.graph.removeFile(path);
  }

  /** 已登记的全部文件（排序）。 */
  files(): string[] {
    return [...this.entries.keys()].sort();
  }
}
