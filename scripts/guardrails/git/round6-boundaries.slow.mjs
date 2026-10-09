import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { outcome, repository } from '../test-repository.mjs';

const TOKEN = 'inner' + 'HTML';
const BAD = `node.${TOKEN} = value;\n`;
const CLEAN = 'export const value = 1;\n';
const PASS = { status: 0, hits: [], caps: [] };
const record = (local, remote) => `refs/heads/feature ${local} refs/heads/feature ${remote}\n`;
const identified = (result) => ({
  ...outcome(result),
  commit: result.diagnostic.match(/^\[([a-f0-9]+)\] /m)?.[1],
});

test('range banned content identifies the requested head commit', (t) => {
  const repo = repository(t);
  repo.write('src/value.ts', CLEAN);
  const base = repo.commit();
  repo.write('src/value.ts', CLEAN + BAD);
  const head = repo.commit();
  assert.deepEqual(identified(repo.check('--range', base, head)), {
    status: 1,
    hits: [['src/value.ts', 2, TOKEN]],
    caps: [],
    commit: head.slice(0, 7),
  });
});

test('range ceiling content identifies the requested head commit', (t) => {
  const repo = repository(t);
  repo.write('backend/src/value.ts', CLEAN);
  const base = repo.commit();
  repo.write('backend/src/value.ts', CLEAN.repeat(351));
  const head = repo.commit();
  assert.deepEqual(identified(repo.check('--range', base, head)), {
    status: 1,
    hits: [],
    caps: [['backend/src/value.ts', 351]],
    commit: head.slice(0, 7),
  });
});

test('push ceiling content identifies its offending intermediate commit', (t) => {
  const repo = repository(t);
  repo.write('src/root.ts', CLEAN);
  const base = repo.commit();
  repo.write('backend/src/value.ts', CLEAN.repeat(351));
  const offending = repo.commit();
  repo.write('src/after.ts', CLEAN);
  const head = repo.commit();
  assert.deepEqual(identified(repo.checkInput(record(head, base), '--push', '--hook', 'origin')), {
    status: 1,
    hits: [],
    caps: [['backend/src/value.ts', 351]],
    commit: offending.slice(0, 7),
  });
});

test('nested staged merge reads MERGE_HEAD at the repository root', (t) => {
  const repo = repository(t);
  repo.write('src/root.ts', CLEAN);
  repo.commit();
  repo.git('branch', 'side');
  repo.write('src/feature.ts', CLEAN);
  repo.commit();
  repo.git('switch', 'side');
  repo.write('src/inherited.ts', BAD);
  repo.commit();
  repo.git('switch', 'feature');
  repo.git('merge', '--no-commit', '--no-ff', 'side');
  const nested = join(repo.root, 'nested/working');
  mkdirSync(nested, { recursive: true });
  assert.deepEqual(outcome(repo.checkAt(nested, '--staged')), PASS);
});

test('staged octopus merge includes its second inherited merge head', (t) => {
  const repo = repository(t);
  repo.write('src/root.ts', CLEAN);
  repo.commit();
  repo.git('branch', 'first');
  repo.git('branch', 'second');
  repo.write('src/feature.ts', CLEAN);
  repo.commit();
  repo.git('switch', 'first');
  repo.write('src/first.ts', CLEAN);
  repo.commit();
  repo.git('switch', 'second');
  repo.write('src/inherited.ts', BAD);
  repo.commit();
  repo.git('switch', 'feature');
  repo.git('merge', '--no-commit', '--no-ff', 'first', 'second');
  assert.deepEqual(outcome(repo.check('--staged')), PASS);
});

test('pre-push input refuses a three-field record', (t) => {
  const repo = repository(t);
  repo.write('src/root.ts', CLEAN);
  const head = repo.commit();
  assert.deepEqual(
    outcome(repo.checkInput(`${head} refs/heads/feature ${head}\n`, '--push', '--hook', 'origin')),
    { status: 2, hits: [], caps: [] },
  );
});

test('pre-push input refuses a nonhex remote object ID', (t) => {
  const repo = repository(t);
  repo.write('src/root.ts', CLEAN);
  const head = repo.commit();
  assert.deepEqual(
    outcome(repo.checkInput(record(head, 'z'.repeat(40)), '--push', '--hook', 'origin')),
    { status: 2, hits: [], caps: [] },
  );
});

test('pre-push input refuses a 41-character hexadecimal remote object ID', (t) => {
  const repo = repository(t);
  repo.write('src/root.ts', CLEAN);
  const head = repo.commit();
  assert.deepEqual(
    outcome(repo.checkInput(record(head, `${head}0`), '--push', '--hook', 'origin')),
    { status: 2, hits: [], caps: [] },
  );
});

test('pre-push input trims trailing whitespace on each record', (t) => {
  const repo = repository(t);
  repo.write('src/root.ts', CLEAN);
  const head = repo.commit();
  const input = record(head, head).replace('\n', '   \n') + record(head, head);
  assert.deepEqual(outcome(repo.checkInput(input, '--push', '--hook', 'origin')), PASS);
});

test('pre-push input rejects a malformed second record', (t) => {
  const repo = repository(t);
  repo.write('src/root.ts', CLEAN);
  const head = repo.commit();
  const input = record(head, head) + `${head} refs/heads/feature ${head}\n`;
  assert.deepEqual(outcome(repo.checkInput(input, '--push', '--hook', 'origin')), {
    status: 2,
    hits: [],
    caps: [],
  });
});

for (const field of ['local', 'remote']) {
  for (const position of ['prefix', 'suffix']) {
    test(`pre-push ${field} object ID rejects an extra ${position}`, (t) => {
      const repo = repository(t);
      repo.write('src/root.ts', CLEAN);
      const head = repo.commit();
      const altered = position === 'prefix' ? `x${head}` : `${head}x`;
      if (field === 'local') repo.git('update-ref', `refs/heads/${altered}`, head);
      const input = field === 'local' ? record(altered, head) : record(head, altered);
      assert.deepEqual(outcome(repo.checkInput(input, '--push', '--hook', 'origin')), {
        status: 2,
        hits: [],
        caps: [],
      });
    });
  }
}

test('--hook requires a destination argument and reports one error line', (t) => {
  const repo = repository(t);
  repo.write('src/root.ts', CLEAN);
  repo.commit();
  const result = repo.checkInput('', '--push', '--hook');
  assert.deepEqual(
    {
      ...outcome(result),
      lines: result.diagnostic.trim().split(/\r?\n/).filter(Boolean).length,
    },
    { status: 2, hits: [], caps: [], lines: 1 },
  );
});

test('manual baseline scans the final range while hook input scans removed intermediate content', (t) => {
  const repo = repository(t);
  repo.write('src/root.ts', CLEAN);
  const base = repo.commit();
  repo.git('branch', 'main', base);
  repo.write('src/temporary.ts', BAD);
  const offending = repo.commit();
  repo.git('rm', 'src/temporary.ts');
  const head = repo.commit();
  assert.deepEqual(
    {
      manual: outcome(repo.checkInput('', '--push')),
      hook: identified(repo.checkInput(record(head, base), '--push', '--hook', 'origin')),
    },
    {
      manual: PASS,
      hook: {
        status: 1,
        hits: [['src/temporary.ts', 1, TOKEN]],
        caps: [],
        commit: offending.slice(0, 7),
      },
    },
  );
});
