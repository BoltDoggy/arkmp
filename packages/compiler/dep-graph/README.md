# @arkmp/dep-graph

文件级依赖图数据结构，维护「文件 → 依赖文件」的边并回答传递闭包查询，为增量编译提供级联重建集合。

## 所属层

L4 compiler（编译内核）

## 依赖

无外部依赖。

## 导出 API

### `class DepGraph`

纯数据结构，无 I/O。依赖关系的提取（如 buildTree 中自定义组件名 → 提供方文件）由调用方完成，本包只维护边并回答两类查询。

#### `addFile(path: string, dependencies?: readonly string[]): void`

登记或整体替换一个文件的直接依赖。重复调用以最后一次为准；`dependencies` 中的自引用边被忽略。

#### `removeFile(path: string): void`

移除文件及其所有关联边（出边与入边一并清理）。

#### `has(path: string): boolean`

图中是否已登记该文件。

#### `files(): string[]`

已登记的全部文件（排序）。

#### `directOptionsOf(path: string): string[]`

直接依赖（不展开传递闭包；无登记时返回空数组，排序）。

#### `dependenciesOf(path: string): string[]`

它依赖的全部文件（传递闭包，排序，不含自身）。

#### `dependentsOf(path: string): string[]`

引用它的全部文件（传递闭包，排序，不含自身）——增量编译级联重建集合的来源。

> **边方向约定**：`addFile('pages/index/Index.ets', ['components/UserCard.ets'])` 表示 Index 依赖 UserCard（UserCard 变更时 Index 需重建）。环形引用安全：遍历带 visited 集合，BFS 不递归，不爆栈。

## 用法示例

```ts
import { DepGraph } from '@arkmp/dep-graph';

const graph = new DepGraph();
graph.addFile('pages/index/Index.ets', ['components/UserCard.ets']);
graph.addFile('components/UserCard.ets', []);

// UserCard 变更 → 哪些文件需重建
console.log(graph.dependentsOf('components/UserCard.ets'));
// → ['pages/index/Index.ets']

// Index 依赖了哪些文件（传递闭包）
console.log(graph.dependenciesOf('pages/index/Index.ets'));
// → ['components/UserCard.ets']
```

## 测试

```bash
pnpm --filter @arkmp/dep-graph test
```
