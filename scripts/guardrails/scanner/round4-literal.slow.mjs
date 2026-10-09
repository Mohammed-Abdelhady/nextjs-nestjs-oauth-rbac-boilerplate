import assert from 'node:assert/strict';
import test from 'node:test';
import { repository, outcome } from '../test-repository.mjs';

test('a literal wildcard cannot pull a large excluded sibling into patch transport', (t) => {
  const repo = repository(t);
  repo.write('backend/src/[ab].ts*', 'export const value = 1;\n');
  repo.write('backend/src/a.ts.png', Buffer.alloc(65 * 1024 * 1024, 120));
  repo.git('add', '.');
  assert.deepEqual(outcome(repo.check('--staged')), { status: 0, hits: [], caps: [] });
});
