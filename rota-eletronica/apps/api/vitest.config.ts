import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 45_000,
    hookTimeout: 45_000,
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    fileParallelism: false,
  },
});
