import { defineConfig } from 'vitest/config';

/**
 * The slow suite: it builds the package and typechecks a generated project per
 * feature combination. Kept out of `npm test` and run by `test:combinations`.
 */
export default defineConfig({
  test: {
    include: ['test/**/*.slow.test.ts'],
    environment: 'node',
    testTimeout: 15 * 60 * 1000,
    hookTimeout: 15 * 60 * 1000,
    // One tsc at a time; the combinations share the repository's node_modules.
    fileParallelism: false,
  },
});
