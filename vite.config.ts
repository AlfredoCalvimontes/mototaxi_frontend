import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // Dev is same-origin like production: the browser only ever talks to Vite,
    // which forwards /api to the FastAPI container. Keeps auth cookies
    // first-party in every environment (plan §1).
    proxy: {
      '/api': {
        target: process.env.VITE_DEV_API_TARGET ?? 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    coverage: {
      provider: 'v8',
      // Fixtures and MSW handlers are test scaffolding: counting them measures
      // how much of the mock we happened to exercise, not the app.
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/test/**',
        'src/main.tsx',
        'src/**/*.test.{ts,tsx}',
        'src/vite-env.d.ts',
        'src/lib/strings.ts',
        'src/api/types.ts',
      ],
      // Set just under the current numbers: a regression fails, ordinary
      // churn does not.
      thresholds: {
        statements: 88,
        lines: 91,
        functions: 84,
        branches: 80,
      },
    },
  },
});
