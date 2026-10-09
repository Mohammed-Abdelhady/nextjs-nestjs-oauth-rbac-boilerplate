import { defineConfig } from 'vitest/config';

/**
 * The slow suite: it builds the package and typechecks a generated project per
 * feature combination. Kept out of `pnpm test` and run by `test:combinations`.
 */
export default defineConfig({
  test: {
    include: ['test/**/*.slow.test.ts'],
    globalSetup: ['./test/combination-setup.ts'],
    environment: 'node',
    testTimeout: 15 * 60 * 1000,
    hookTimeout: 15 * 60 * 1000,
    // One project at a time; combinations share their temporary pnpm store.
    fileParallelism: false,
  },
});
