import assert from 'node:assert/strict';
import test from 'node:test';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { repository, outcome } from './test-repository.mjs';

const TOKEN = 'inner' + 'HTML';
const BAD = `node.${TOKEN} = value;\n`;
const CLEAN = 'export const value = 1;\n';

for (const mode of ['--staged', '--all', '--push']) {
  test(`${mode} refuses an unexpected trailing argument`, (t) => {
    const repo = repository(t);
    repo.write('src/value.ts', CLEAN);
    repo.commit();
    assert.deepEqual(outcome(repo.check(mode, 'unexpected')), { status: 2, hits: [], caps: [] });
  });
}

test('one Git failure with embedded newlines is reported on one line', (t) => {
  const repo = repository(t);
  repo.write('src/value.ts', CLEAN);
  repo.commit();
  const result = repo.check('--range', 'missing\nsecond\nthird', 'HEAD');
  assert.deepEqual(
    { ...outcome(result), lines: result.diagnostic.trim().split('\n').filter(Boolean).length },
    { status: 2, hits: [], caps: [], lines: 1 },
  );
});

test('forced colour configuration does not hide staged banned content', (t) => {
  const repo = repository(t);
  repo.git('config', 'color.ui', 'always');
  repo.git('config', 'color.diff', 'always');
  repo.write('src/value.ts', BAD);
  repo.git('add', '.');
  assert.deepEqual(outcome(repo.check('--staged')), {
    status: 1,
    hits: [['src/value.ts', 1, TOKEN]],
    caps: [],
  });
});

test('CRLF additions report head logical line numbers', (t) => {
  const repo = repository(t);
  repo.write('src/value.ts', CLEAN.replace('\n', '\r\n'));
  repo.commit();
  repo.write(
    'src/value.ts',
    CLEAN.replace('\n', '\r\n') + CLEAN.replace('\n', '\r\n') + BAD.replace('\n', '\r\n'),
  );
  repo.git('add', '.');
  assert.deepEqual(outcome(repo.check('--staged')), {
    status: 1,
    hits: [['src/value.ts', 3, TOKEN]],
    caps: [],
  });
});

test('full scan ignores a tracked file removed from disk', (t) => {
  const repo = repository(t);
  repo.write('src/deleted.ts', BAD);
  repo.commit();
  rmSync(join(repo.root, 'src/deleted.ts'));
  assert.deepEqual(outcome(repo.check('--all')), { status: 0, hits: [], caps: [] });
});

test('strict denial never allows a non-DOM gate bypass token', (t) => {
  const repo = repository(t);
  repo.write('src/denial.test.ts', "expect(source).not.toContain('--no-" + "verify');\n");
  repo.git('add', '.');
  assert.deepEqual(outcome(repo.check('--staged')), {
    status: 1,
    hits: [['src/denial.test.ts', 1, '--no-' + 'verify']],
    caps: [],
  });
});

for (const path of ['scripts/guardrails/policy.mjs', 'scripts/check-hard-bans.test.mjs']) {
  test(`only the exact data-bearing path is exempt: ${path}`, (t) => {
    const repo = repository(t);
    repo.write(path, BAD);
    repo.write('nested/' + path, BAD);
    repo.git('add', '.');
    assert.deepEqual(outcome(repo.check('--staged')), {
      status: 1,
      hits: [['nested/' + path, 1, TOKEN]],
      caps: [],
    });
  });
}

for (const path of ['scripts/guardrails/logic.mjs', 'scripts/check-hard-bans.mjs']) {
  test(`checker-owned source retains the ceiling: ${path}`, (t) => {
    const repo = repository(t);
    repo.write(path, CLEAN.repeat(351));
    repo.git('add', '.');
    assert.deepEqual(outcome(repo.check('--staged')), {
      status: 1,
      hits: [],
      caps: [[path, 351]],
    });
  });
}

test('literal glob-named sources retain both sibling paths', (t) => {
  const repo = repository(t);
  repo.write('src/[ab].ts', BAD);
  repo.write('src/a.ts', CLEAN + BAD);
  repo.git('add', '.');
  assert.deepEqual(outcome(repo.check('--staged')), {
    status: 1,
    hits: [
      ['src/[ab].ts', 1, TOKEN],
      ['src/a.ts', 2, TOKEN],
    ],
    caps: [],
  });
});

test('a CR-only Git failure is reported on one nonempty logical line', (t) => {
  const repo = repository(t);
  repo.write('src/value.ts', CLEAN);
  repo.commit();
  const result = repo.check('--range', 'missing\rsecond\rthird', 'HEAD');
  assert.deepEqual(
    { ...outcome(result), lines: result.diagnostic.trim().split(/\r\n|\r|\n/).filter(Boolean).length },
    { status: 2, hits: [], caps: [], lines: 1 },
  );
});
