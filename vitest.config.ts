import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  // Build-time constants injected by WXT (wxt.config.ts `define`) that component
  // tests need at render time — e.g. MorePanel's version footer.
  define: {
    __VERSION__: JSON.stringify('test'),
    __GIT_HASH__: JSON.stringify('test'),
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    setupFiles: ['tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
