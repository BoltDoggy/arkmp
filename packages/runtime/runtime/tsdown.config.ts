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
    // target:es2019 转译可选链(?.)、空值合并(??) 等 ES2020 语法，
    // 保留对象展开等 ES2018 语法（微信小程序引擎已原生支持），
    // 避免注入 Babel helper 导致产物超出 10KB 预算。
    // minify 去注释/空白以控制在 10KB 预算内（mangle:false 保留变量名便于堆栈定位）。
    entry: { runtime: 'src/index.ts' },
    format: ['cjs'],
    target: 'es2019',
    minify: { mangle: false, compress: true, codegen: true },
    dts: false,
    sourcemap: false,
    clean: false,
    outExtensions: () => ({ js: '.js' }),
  },
]);
