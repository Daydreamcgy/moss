import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { port: 5188, strictPort: true },
  build: { outDir: 'dist', assetsInlineLimit: 0, target: 'chrome110' },
});
