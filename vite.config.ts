import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig(({ mode }) => ({
  build: {
    emptyOutDir: false,
    minify: mode === 'production' ? 'esbuild' : false,
    sourcemap: mode === 'development',
    lib: {
      entry: resolve(process.cwd(), 'src/index.ts'),
      name: 'Navigation',
      fileName: () => 'navigation.browser.js',
      formats: ['es'],
    },
    rollupOptions: {
      external: ['gsap'],
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
}));
