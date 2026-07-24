import { noConcurrent } from '../src/rules/no-concurrent.js';
import { ruleTester } from './helpers.js';

ruleTester.run('no-concurrent', noConcurrent, {
  valid: [
    '@Component class A {}',
    'class A { async load() { await Promise.all([]); } }',
  ],
  invalid: [
    // E1004：@Concurrent 方法
    {
      code: 'class A { @Concurrent heavy() { return 1; } }',
      errors: [{ messageId: 'concurrent' }],
    },
    {
      code: 'class A { @Concurrent static compute() { return 0; } }',
      errors: [{ messageId: 'concurrent' }],
    },
  ],
});
