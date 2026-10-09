import assert from 'node:assert/strict';
import test from 'node:test';
import { requireTargetPatches } from '../git/git-diff.mjs';

test('every target must have exactly one matching content patch', () => {
  const targets = [
    { path: 'src/a.ts', oid: 'first' },
    { path: 'src/b.ts', oid: 'second' },
  ];
  assert.doesNotThrow(() =>
    requireTargetPatches(targets, [
      { path: 'src/b.ts', oid: 'second' },
      { path: 'src/a.ts', oid: 'first' },
    ]),
  );
  assert.doesNotThrow(() => requireTargetPatches([], []));
  for (const patches of [
    [],
    [{ path: 'src/a.ts', oid: 'first' }],
    [
      { path: 'src/a.ts', oid: 'wrong' },
      { path: 'src/b.ts', oid: 'second' },
    ],
    [
      { path: 'src/a.ts', oid: 'first' },
      { path: 'src/a.ts', oid: 'first' },
      { path: 'src/b.ts', oid: 'second' },
    ],
  ])
    assert.throws(() => requireTargetPatches(targets, patches), /content patch.*target path/);
});
