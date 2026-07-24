import { noLazyForEach } from '../src/rules/no-lazy-foreach.js';
import { ruleTester } from './helpers.js';

ruleTester.run('no-lazy-foreach', noLazyForEach, {
  valid: [
    'class A { build() { ForEach(this.list, (item) => { Text(item); }); } }',
    'class A { build() { List(); } }',
  ],
  invalid: [
    // E1001：LazyForEach 调用
    {
      code: 'class A { build() { LazyForEach(this.source, (item) => { Text(item); }); } }',
      errors: [{ messageId: 'lazyForEach' }],
    },
    // E1001：IDataSource 协议实现
    {
      code: 'class MySource implements IDataSource { totalCount() { return 0; } }',
      errors: [{ messageId: 'dataSource' }],
    },
  ],
});
