import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

// Tests run against a separate database (TEST_DATABASE_URL), never the dev one.
const env = loadEnv('test', '..', '');

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 20000,
    hookTimeout: 30000,
    fileParallelism: false,
    env: {
      ...env,
      NODE_ENV: 'test',
      DATABASE_URL: env.TEST_DATABASE_URL || (env.DATABASE_URL ?? '').replace(/\/([^/?]+)(\?|$)/, '/$1_test$2'),
    },
  },
});
