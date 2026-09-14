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
    // tsc compiles __tests__ into dist/ — running those copies fails because
    // vi.mock paths no longer resolve after the .ts → .js import rewrite.
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
}));
