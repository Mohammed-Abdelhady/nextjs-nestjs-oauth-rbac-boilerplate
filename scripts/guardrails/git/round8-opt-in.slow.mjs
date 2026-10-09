import assert from 'node:assert/strict';
import test from 'node:test';
import { outcome } from '../test-repository.mjs';
import {
  BAD,
  CLEAN,
  GATES,
  TOKEN,
  ZERO,
  fixture,
  gates,
  push,
  received,
  remote,
} from './round8-hook-fixture.mjs';

for (const baseline of ['baseline', '-baseline']) {
  test(`explicit pushBase ${baseline} leaves later own violations checked`, (t) => {
    const repo = fixture(t);
    repo.git('branch', '-m', 'main');
    const destination = remote(t, repo, 'origin');
    repo.git('push', '-u', 'origin', 'main');
    repo.write('src/inherited.ts', CLEAN + BAD);
    const trusted = repo.commit();
    repo.git('tag', '-a', 'baseline', '-m', 'test: baseline');
    if (baseline === '-baseline') repo.git('update-ref', '--', '-baseline', trusted);
    repo.git('switch', '-c', 'feat');
    repo.write('src/clean.ts', CLEAN);
    repo.commit();
    repo.git('config', 'guardrails.pushBase', baseline);
    const clean = push(repo, 'origin', 'feat');
    assert.deepEqual(
      {
        status: clean.status,
        hits: clean.hits,
        gates: gates(repo),
        branch: received(destination, 'feat'),
      },
      { status: 0, hits: [], gates: GATES, branch: '3' },
    );
    repo.write('src/own.ts', CLEAN + BAD);
    const own = repo.commit();
    const dirty = push(repo, 'origin', 'feat');
    assert.deepEqual(
      {
        status: dirty.status,
        hits: dirty.hits,
        gates: gates(repo),
        branch: received(destination, 'feat'),
      },
      { status: 1, hits: [[own.slice(0, 7), 'src/own.ts', 2, TOKEN]], gates: GATES, branch: '3' },
    );
  });
}

for (const base of [
  '',
  'missing-baseline',
  'tree',
  'blob',
  'https://fixture:fixture-secret@example.invalid/no-commit',
]) {
  test(`invalid pushBase is credential-safe and stops real hooks: ${base === '' ? 'empty' : base.startsWith('https:') ? 'credential' : base}`, (t) => {
    const repo = fixture(t);
    repo.git('branch', '-m', 'main');
    const destination = remote(t, repo, 'origin');
    repo.git('push', '-u', 'origin', 'main');
    repo.git('switch', '-c', 'feat');
    repo.write('src/clean.ts', CLEAN);
    const head = repo.commit();
    const configured =
      base === 'tree'
        ? repo.git('rev-parse', 'HEAD^{tree}')
        : base === 'blob'
          ? repo.git('rev-parse', 'HEAD:src/clean.ts')
          : base;
    repo.git('config', 'guardrails.pushBase', configured);
    const check = repo.checkInput(
      `refs/heads/feat ${head} refs/heads/feat ${ZERO}\n`,
      '--push',
      '--hook',
      'origin',
    );
    assert.deepEqual(
      {
        ...outcome(check),
        lines: check.diagnostic.trim().split('\n').filter(Boolean).length,
        leaksCredential: check.diagnostic.includes('fixture-secret'),
        identifiesConfig: check.diagnostic.includes('guardrails.pushBase'),
      },
      { status: 2, hits: [], caps: [], lines: 1, leaksCredential: false, identifiesConfig: true },
    );
    const result = push(repo, 'origin', 'feat');
    assert.deepEqual(
      {
        status: result.status,
        hits: result.hits,
        gates: gates(repo),
        branch: received(destination, 'feat'),
        leaksCredential: result.diagnostic.includes('fixture-secret'),
        identifiesConfig: result.diagnostic.includes('guardrails.pushBase'),
      },
      {
        status: 1,
        hits: [],
        gates: [],
        branch: null,
        leaksCredential: false,
        identifiesConfig: true,
      },
    );
  });
}
