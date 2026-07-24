# @arkmp/incremental

以文件为单位的增量编译缓存：缓存源码哈希与 ComponentModel，配合依赖图做级联失效。

## 所属层

L4 compiler（编译内核）

## 依赖

| 依赖 | 原因 |
| --- | --- |
| `@arkmp/dep-graph` | 级联失效来源：`dependentsOf` 传递闭包 |
| `@arkmp/ir` | ComponentModel 类型定义（缓存对象） |
| `@arkmp/shared` | `hashContent` 计算源码哈希 |

## 导出 API

### `class IncrementalCache`

纯内存结构，无 I/O。文件内容的读取与编译由调用方负责。

#### `constructor(graph?: DepGraph)`

可选注入外部依赖图，缺省内部新建一个。

#### `readonly graph: DepGraph`

文件级依赖图实例，调用方可通过它补充查询。

#### `update(path: string, source: string, model: ComponentModel, dependencies?: readonly string[]): void`

编译完成后登记文件：记录源码哈希、ComponentModel 与直接依赖（整体替换旧边）。

#### `get(path: string, source: string): ComponentModel | undefined`

查询缓存：文件已登记且源码哈希未变时返回缓存的 ComponentModel（可跳过重编译）；否则返回 `undefined`（调用方应重编译并 `update`）。

#### `has(path: string): boolean`

是否持有该文件的有效缓存（仅判断是否登记过，不校验哈希）。

#### `invalidate(changedFiles: readonly string[]): string[]`

失效判定：返回需要重建的文件集合（排序去重）——变更文件本身 ∪ 依赖图中各变更文件的 `dependentsOf` 传递闭包，并同步清除这些文件的缓存条目。未知的变更文件（新增文件）原样包含在结果中。

#### `remove(path: string): void`

文件删除：清除缓存条目与依赖图节点。

#### `files(): string[]`

已登记的全部文件（排序）。

## 用法示例

```ts
import { IncrementalCache } from '@arkmp/incremental';
// compile 来自 @arkmp/pipeline
import { compile } from '@arkmp/pipeline';

const cache = new IncrementalCache();

// 首次编译后登记
const result = compile(source, { fileName: 'pages/index/Index.ets' });
cache.update('pages/index/Index.ets', source, result.model, ['components/UserCard.ets']);

// 下次编译前查询：哈希未变则命中
const cached = cache.get('pages/index/Index.ets', source);
if (cached) {
  console.log('命中缓存，跳过重编译');
} else {
  const fresh = compile(source, { fileName: 'pages/index/Index.ets' });
  cache.update('pages/index/Index.ets', source, fresh.model, ['components/UserCard.ets']);
}

// UserCard 变更时，计算级联重建集合
const rebuild = cache.invalidate(['components/UserCard.ets']);
console.log('需重建:', rebuild);
```

## 测试

```bash
pnpm --filter @arkmp/incremental test
```
