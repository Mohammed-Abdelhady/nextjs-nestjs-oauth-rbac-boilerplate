import assert from 'node:assert/strict';
import test from 'node:test';
import { join } from 'node:path';
import { outcome } from '../test-repository.mjs';
import { BAD, CLEAN, TOKEN, ZERO, fixture, remote } from './round8-hook-fixture.mjs';

function configuredProject(t) {
  const repo = fixture(t);
  repo.git('branch', '-m', 'main');
  remote(t, repo, 'origin');
  repo.git('push', '-u', 'origin', 'main');
  repo.write('src/inherited.ts', BAD);
  const inherited = repo.commit();
  repo.git('tag', '-a', 'baseline', '-m', 'test: baseline');
  repo.git('update-ref', '--', '-baseline', inherited);
  repo.git('switch', '-c', 'feat');
  repo.write('src/clean.ts', CLEAN);
  const head = repo.commit();
  const scan = () =>
    repo.checkInput(
      `refs/heads/feat ${repo.git('rev-parse', 'HEAD')} refs/heads/feat ${ZERO}\n`,
      '--push',
      '--hook',
      'origin',
    );
  return { repo, inherited, head, scan };
}

for (const value of ['full', 'abbreviated', 'main', 'baseline', '-baseline', 'HEAD']) {
  test(`pushBase resolves and announces one bare commit: ${value}`, (t) => {
    const { repo, inherited, head, scan } = configuredProject(t);
    const configured =
      value === 'full' ? inherited : value === 'abbreviated' ? inherited.slice(0, 8) : value;
    repo.git('config', 'guardrails.pushBase', configured);
    const result = scan();
    assert.deepEqual(outcome(result), { status: 0, hits: [], caps: [] });
    assert.deepEqual(result.diagnostic.trim().split('\n'), [
      `trusting guardrails.pushBase ${(value === 'HEAD' ? head : inherited).slice(0, 7)}`,
    ]);
    repo.write('src/own.ts', BAD);
    const own = repo.commit();
    const next = scan();
    if (value === 'HEAD') {
      assert.deepEqual(outcome(next), { status: 0, hits: [], caps: [] });
      assert.deepEqual(next.diagnostic.trim().split('\n'), [
        `trusting guardrails.pushBase ${own.slice(0, 7)}`,
      ]);
    } else {
      assert.deepEqual(outcome(next), { status: 1, hits: [['src/own.ts', 1, TOKEN]], caps: [] });
      assert.equal(
        next.diagnostic
          .split('\n')
          .filter((line) => line.startsWith('trusting guardrails.pushBase')).length,
        1,
      );
      assert.equal(next.diagnostic.includes(`[${own.slice(0, 7)}]`), true);
    }
  });
}

for (const value of ['^main', 'main..feat', '', 'missing', 'tree', 'blob']) {
  test(`invalid revision control is a generic pushBase failure: ${value || 'empty'}`, (t) => {
    const { repo, scan } = configuredProject(t);
    const configured =
      value === 'tree'
        ? repo.git('rev-parse', 'HEAD^{tree}')
        : value === 'blob'
          ? repo.git('rev-parse', 'HEAD:src/clean.ts')
          : value;
    repo.git('config', 'guardrails.pushBase', configured);
    const result = scan();
    assert.deepEqual(
      {
        ...outcome(result),
        lines: result.diagnostic.trim().split('\n').filter(Boolean).length,
        identifiesConfig: result.diagnostic.includes('guardrails.pushBase'),
        notices: result.diagnostic
          .split('\n')
          .filter((line) => line.startsWith('trusting guardrails.pushBase')).length,
      },
      { status: 2, hits: [], caps: [], lines: 1, identifiesConfig: true, notices: 0 },
    );
  });
}

for (const scope of ['global', 'environment']) {
  test(`resolved opt-in remains visible from isolated ${scope} config`, (t) => {
    const { repo, inherited, scan } = configuredProject(t);
    if (scope === 'global') {
      repo.write('fixture-global.cfg', `[guardrails]\n pushBase = ${inherited}\n`);
      repo.env.GIT_CONFIG_GLOBAL = join(repo.root, 'fixture-global.cfg');
    } else {
      repo.env.GIT_CONFIG_COUNT = '1';
      repo.env.GIT_CONFIG_KEY_0 = 'guardrails.pushBase';
      repo.env.GIT_CONFIG_VALUE_0 = inherited;
    }
    const result = scan();
    assert.deepEqual(outcome(result), { status: 0, hits: [], caps: [] });
    assert.deepEqual(result.diagnostic.trim().split('\n'), [
      `trusting guardrails.pushBase ${inherited.slice(0, 7)}`,
    ]);
  });
}

test('manual push does not apply hook-only moving HEAD trust', (t) => {
  const { repo } = configuredProject(t);
  repo.write('src/own.ts', BAD);
  repo.commit();
  repo.git('config', 'guardrails.pushBase', 'HEAD');
  const result = repo.checkInput('', '--push');
  assert.deepEqual(outcome(result), { status: 1, hits: [['src/own.ts', 1, TOKEN]], caps: [] });
  assert.equal(result.diagnostic.includes('trusting guardrails.pushBase'), false);
});

for (const warning of ['absent default', 'configured unknown']) {
  test(`invalid opt-in precedes unrelated trust warning: ${warning}`, (t) => {
    const { repo, scan } = configuredProject(t);
    if (warning === 'absent default') repo.git('remote', 'rename', 'origin', 'upstream');
    else repo.git('config', 'guardrails.trustedRemotes', 'ghost');
    repo.git('config', 'guardrails.pushBase', 'missing');
    const result = scan();
    assert.deepEqual(
      {
        ...outcome(result),
        lines: result.diagnostic.trim().split('\n').filter(Boolean).length,
        identifiesConfig: result.diagnostic.includes('guardrails.pushBase'),
        warnings: result.diagnostic.includes('guardrails.trustedRemotes'),
        notices: result.diagnostic.includes('trusting guardrails.pushBase'),
      },
      {
        status: 2,
        hits: [],
        caps: [],
        lines: 1,
        identifiesConfig: true,
        warnings: false,
        notices: false,
      },
    );
  });
}
