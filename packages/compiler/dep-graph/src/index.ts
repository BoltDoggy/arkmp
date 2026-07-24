/**
 * @arkmp/dep-graph —— L4 文件级依赖图（docs/arkui-miniprogram/02-pipeline.md ⑥）。
 *
 * 纯数据结构，无 I/O：依赖关系的提取（如「buildTree 中出现的自定义组件名 →
 * 提供方文件」）由调用方完成，本包只维护 文件 → 依赖文件 的边并回答两类查询：
 *
 * - `dependentsOf(path)`：谁（传递）引用了它 —— 增量编译的级联重建集合来源；
 * - `dependenciesOf(path)`：它（传递）依赖谁。
 *
 * 约定：
 * - 边方向：`addFile('pages/index/Index.ets', ['components/UserCard.ets'])`
 *   表示 Index 依赖 UserCard（UserCard 变更时 Index 需重建）；
 * - 两个查询均返回**传递闭包**，排序后输出（确定性），且不含查询文件自身
 *   （环形引用时也不会把自身算进去）；
 * - 环形引用安全：遍历带 visited 集合，不递归，不爆栈。
 */
export class DepGraph {
  /** 正向边：文件 → 它直接依赖的文件集合。 */
  private readonly deps = new Map<string, Set<string>>();
  /** 反向边：文件 → 直接引用它的文件集合。 */
  private readonly reverse = new Map<string, Set<string>>();

  /**
   * 登记（或整体替换）一个文件的直接依赖。
   * 重复调用以最后一次为准；`dependencies` 中的自引用边被忽略。
   */
  addFile(path: string, dependencies: readonly string[] = []): void {
    // 先清掉旧边（正反向同步）
    this.removeEdgesOf(path);

    const unique = new Set(dependencies.filter((dep) => dep !== path));
    this.deps.set(path, unique);
    for (const dep of unique) {
      let referrers = this.reverse.get(dep);
      if (referrers === undefined) {
        referrers = new Set();
        this.reverse.set(dep, referrers);
      }
      referrers.add(path);
    }
  }

  /** 移除文件及其所有关联边（出边与入边一并清理）。 */
  removeFile(path: string): void {
    this.removeEdgesOf(path);
    // 入边：引用 path 的文件，其依赖集合中的 path 一并摘除
    const referrers = this.reverse.get(path);
    if (referrers !== undefined) {
      for (const referrer of referrers) {
        this.deps.get(referrer)?.delete(path);
      }
    }
    this.deps.delete(path);
    this.reverse.delete(path);
  }

  /** 图中是否已登记该文件。 */
  has(path: string): boolean {
    return this.deps.has(path);
  }

  /** 已登记的全部文件（排序）。 */
  files(): string[] {
    return [...this.deps.keys()].sort();
  }

  /** 直接依赖（不展开传递闭包；无登记时返回空数组）。 */
  directDependenciesOf(path: string): string[] {
    return [...(this.deps.get(path) ?? [])].sort();
  }

  /** 它依赖的全部文件（传递闭包，排序，不含自身）。 */
  dependenciesOf(path: string): string[] {
    return this.closure(path, this.deps);
  }

  /** 引用它的全部文件（传递闭包，排序，不含自身）——级联重建集合来源。 */
  dependentsOf(path: string): string[] {
    return this.closure(path, this.reverse);
  }

  /** 沿给定边表做 BFS 求传递闭包；visited 防环，不递归。 */
  private closure(start: string, edges: ReadonlyMap<string, ReadonlySet<string>>): string[] {
    const visited = new Set<string>([start]);
    const queue = [...(edges.get(start) ?? [])];
    const result: string[] = [];
    while (queue.length > 0) {
      const current = queue.shift() as string;
      if (visited.has(current)) continue;
      visited.add(current);
      result.push(current);
      for (const next of edges.get(current) ?? []) {
        if (!visited.has(next)) queue.push(next);
      }
    }
    return result.sort();
  }

  /** 清除 path 作为「依赖方」的全部边（正向 + 反向同步）。 */
  private removeEdgesOf(path: string): void {
    const old = this.deps.get(path);
    if (old !== undefined) {
      for (const dep of old) {
        const referrers = this.reverse.get(dep);
        if (referrers !== undefined) {
          referrers.delete(path);
          if (referrers.size === 0) this.reverse.delete(dep);
        }
      }
      this.deps.delete(path);
    }
  }
}
