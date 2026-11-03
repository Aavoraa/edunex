import path from 'node:path';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

const env = loadEnv('test', path.resolve(import.meta.dirname, '..'), '');

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.tsx'],
    setupFiles: ['tests/setup.ts'],
    css: false,
    env: {
      SEED_DEMO_PASSWORD: env.SEED_DEMO_PASSWORD ?? '',
      VITE_API_BASE_URL: `${env.API_URL ?? 'http://127.0.0.1:4000'}/api`,
    },
  },
});
