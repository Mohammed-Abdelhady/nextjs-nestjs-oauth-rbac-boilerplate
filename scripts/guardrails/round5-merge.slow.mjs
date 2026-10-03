import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { outcome, repository } from './test-repository.mjs';

const TOKEN = 'inner' + 'HTML';
const BAD = `node.${TOKEN} = value;\n`;
const CLEAN = 'export const value = 1;\n';
const PASS = { status: 0, hits: [], caps: [] };

function parents(t, left, right) {
  const repo = repository(t);
  repo.write('src/conflict.ts', 'export const choice = 0;\n');
  repo.commit();
  repo.git('branch', 'side');
  for (const [path, content] of Object.entries(left)) repo.write(path, content);
  const first = repo.commit();
  repo.git('switch', 'side');
  for (const [path, content] of Object.entries(right)) repo.write(path, content);
  repo.commit();
  spawnSync(
    'git',
    ['-c', 'core.hooksPath=/dev/null', 'merge', '--no-commit', '--no-ff', 'feature'],
    {
      cwd: repo.root,
      env: repo.env,
      encoding: 'utf8',
    },
  );
  return { repo, first };
}

function resolved(repo, content = CLEAN) {
  repo.write('src/conflict.ts', content);
  repo.git('add', '.');
}

test('a resolved staged merge does not blame a banned line inherited from one parent', (t) => {
  const { repo } = parents(t, { 'src/legacy.ts': BAD }, { 'src/side.ts': CLEAN });
  resolved(repo);
  assert.deepEqual(outcome(repo.check('--staged')), PASS);
});

test('a resolved staged merge refuses a resolution-only token with its path and line', (t) => {
  const { repo } = parents(
    t,
    { 'src/conflict.ts': 'export const choice = 1;\n' },
    { 'src/conflict.ts': 'export const choice = 2;\n' },
  );
  resolved(repo, CLEAN + BAD);
  assert.deepEqual(outcome(repo.check('--staged')), {
    status: 1,
    hits: [['src/conflict.ts', 2, TOKEN]],
    caps: [],
  });
});

for (const mode of ['staged', 'push']) {
  test(`merge ceiling intersection keeps inherited paths separate in ${mode}`, (t) => {
    const { repo, first } = parents(
      t,
      { 'backend/src/left.ts': CLEAN.repeat(351) },
      { 'backend/src/right.ts': CLEAN.repeat(351) },
    );
    resolved(repo);
    let result = repo.check('--staged');
    if (mode === 'push') {
      const head = repo.commit();
      const side = repo.git('rev-parse', 'HEAD^1');
      const input =
        `refs/heads/side ${head} refs/heads/side ${side}\n` +
        `refs/heads/feature ${first} refs/heads/feature ${first}\n`;
      result = repo.checkInput(input, '--push', '--hook', 'origin');
    }
    assert.deepEqual(outcome(result), PASS);
  });
}

for (const mode of ['staged', 'push']) {
  test(`merge resolution source ceiling is enforced in ${mode}`, (t) => {
    const { repo, first } = parents(t, { 'src/left.ts': CLEAN }, { 'src/right.ts': CLEAN });
    resolved(repo);
    repo.write('backend/src/new.ts', CLEAN.repeat(351));
    repo.git('add', '.');
    let result = repo.check('--staged');
    if (mode === 'push') {
      const head = repo.commit();
      const side = repo.git('rev-parse', 'HEAD^1');
      result = repo.checkInput(
        `refs/heads/side ${head} refs/heads/side ${side}\n` +
          `refs/heads/feature ${first} refs/heads/feature ${first}\n`,
        '--push',
        '--hook',
        'origin',
      );
    }
    assert.deepEqual(outcome(result), {
      status: 1,
      hits: [],
      caps: [['backend/src/new.ts', 351]],
    });
  });
}

for (const mode of ['staged', 'push']) {
  test(`merge ban intersection requires the actual added line in ${mode}`, (t) => {
    const { repo, first } = parents(
      t,
      { 'src/conflict.ts': BAD + CLEAN },
      { 'src/conflict.ts': CLEAN + BAD },
    );
    resolved(repo, BAD + CLEAN + BAD);
    let result = repo.check('--staged');
    if (mode === 'push') {
      const head = repo.commit();
      const side = repo.git('rev-parse', 'HEAD^1');
      result = repo.checkInput(
        `refs/heads/side ${head} refs/heads/side ${side}\n` +
          `refs/heads/feature ${first} refs/heads/feature ${first}\n`,
        '--push',
        '--hook',
        'origin',
      );
    }
    assert.deepEqual(outcome(result), PASS);
  });
}

for (const mode of ['staged', 'push']) {
  test(`merge ban intersection keeps different inherited paths separate in ${mode}`, (t) => {
    const { repo, first } = parents(t, { 'src/left.ts': BAD }, { 'src/right.ts': BAD });
    resolved(repo);
    let result = repo.check('--staged');
    if (mode === 'push') {
      const head = repo.commit();
      const side = repo.git('rev-parse', 'HEAD^1');
      result = repo.checkInput(
        `refs/heads/side ${head} refs/heads/side ${side}\n` +
          `refs/heads/feature ${first} refs/heads/feature ${first}\n`,
        '--push',
        '--hook',
        'origin',
      );
    }
    assert.deepEqual(outcome(result), PASS);
  });
}
