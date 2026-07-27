import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts', 'src/cli.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  // 将内部 @arkmp/* 包打进 bundle，发布到 npm 后不再依赖 workspace。
  // @arkmp/compiler 和 @arkmp/runtime 已发布到 npm，保持 external。
  // 第三方依赖（typescript / chokidar 等）也保持 external，不打入产物。
  deps: {
    neverBundle: true,
    alwaysBundle: [/^@arkmp\/(?!compiler)(?!runtime)/],
  },
});
