import assert from 'node:assert/strict';
import test from 'node:test';
import { selectRange } from './range.mjs';

const BASE = '1'.repeat(40);
const HEAD = '2'.repeat(40);
const COMMON = '3'.repeat(40);
const ZERO = '0'.repeat(40);
const INPUT = { eventName: 'push', before: BASE, head: HEAD, beforeIsAncestor: true };

const CASES = [
  [
    'pull request',
    { eventName: 'pull_request', base: BASE, head: HEAD },
    { mode: 'range', base: BASE, head: HEAD },
  ],
  ['fast-forward push', INPUT, { mode: 'range', base: BASE, head: HEAD }],
  [
    'new branch',
    { ...INPUT, before: ZERO, defaultMergeBase: COMMON },
    { mode: 'range', base: COMMON, head: HEAD },
  ],
  [
    'force push',
    { ...INPUT, beforeIsAncestor: false, defaultMergeBase: COMMON },
    { mode: 'range', base: COMMON, head: HEAD },
  ],
  ['deleted ref', { ...INPUT, head: ZERO }, { mode: 'skip' }],
  ['deleted event', { ...INPUT, deleted: true }, { mode: 'skip' }],
  [
    'merge queue',
    { ...INPUT, eventName: 'merge_group', before: undefined, defaultMergeBase: COMMON },
    { mode: 'range', base: COMMON, head: HEAD },
  ],
  ['re-run missing before', { ...INPUT, before: undefined }, { mode: 'all', head: HEAD }],
  [
    'unrelated default history',
    { ...INPUT, before: ZERO, defaultMergeBase: null },
    { mode: 'all', head: HEAD },
  ],
  [
    'default already at head',
    { ...INPUT, before: ZERO, defaultMergeBase: HEAD },
    { mode: 'all', head: HEAD },
  ],
  ['missing default ref', { ...INPUT, beforeIsAncestor: false }, { mode: 'all', head: HEAD }],
];
for (const [name, input, expected] of CASES) {
  test(`selectRange: ${name}`, () => assert.deepEqual(selectRange(input), expected));
}

test('missing or malformed event commits cannot silently pass', () => {
  for (const input of [
    { eventName: 'pull_request', head: HEAD },
    { eventName: 'pull_request', base: BASE },
    { eventName: 'push', head: '--help' },
    { eventName: 'push', head: null },
  ])
    assert.throws(() => selectRange(input), /commit/);
});
