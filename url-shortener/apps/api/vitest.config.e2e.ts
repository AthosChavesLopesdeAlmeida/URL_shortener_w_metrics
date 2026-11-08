import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.e2e-spec.ts'],
    setupFiles: ['./test/setup-env.ts'],
    fileParallelism: false, // arquivos e2e compartilham o mesmo banco
    hookTimeout: 30_000,
    testTimeout: 15_000,
  },
  plugins: [swc.vite({ module: { type: 'es6' } })],
});