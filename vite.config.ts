import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: { outDir: 'dist', sourcemap: true },
  test: { include: ['tests/**/*.test.ts'] },
});
