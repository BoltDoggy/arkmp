import { defineConfig } from 'tsdown';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
  },
  {
    // 单文件产物：编译器拷贝为小程序工程里的 arkmp/runtime.js
    entry: { runtime: 'src/index.ts' },
    format: ['cjs'],
    dts: false,
    sourcemap: false,
    clean: false,
    outExtensions: () => ({ js: '.js' }),
  },
]);
