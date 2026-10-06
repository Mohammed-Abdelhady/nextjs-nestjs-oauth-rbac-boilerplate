import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, readFileSync } from 'node:fs';
import { fetchArguments, fetchAuthentication } from './fetch.mjs';
import { join } from 'node:path';
import test from 'node:test';
import { repository, installChecker } from '../guardrails/test-repository.mjs';

function fixture(t) {
  const repo = repository(t);
  installChecker(repo.root, { directory: 'scripts' });
  for (const file of [
    'ci.mjs',
    'ci/runner.mjs',
    'ci/range.mjs',
    'ci/event-range.mjs',
    'ci/cache.mjs',
    'ci/fetch.mjs',
  ]) {
    repo.write(`scripts/${file}`, '');
    const source = new URL(`../${file}`, import.meta.url);
    copyFileSync(source, join(repo.root, 'scripts', file));
  }
  repo.write('scripts/ci/gates.json', '{"install":{},"gates":[]}');
  repo.write('src/feature.js', 'export const safe = true;\n');
  return repo;
}

for (const attack of ['exempt path', 'skip directory', 'replace entry and gates and workflow']) {
  test(`base checkout rejects PR attack: ${attack}`, (t) => {
    const repo = fixture(t);
    const base = repo.commit();
    const token = 'inner' + 'HTML';
    repo.write('src/feature.js', `const host = {}; host.${token} = 'x';\n`);
    const policy = join(repo.root, 'scripts/guardrails/policy.mjs');
    if (attack === 'exempt path')
      repo.write(
        'scripts/guardrails/policy.mjs',
        readFileSync(policy, 'utf8').replace(
          'export const EXEMPT_PATHS = [',
          "export const EXEMPT_PATHS = ['src/feature.js', ",
        ),
      );
    else if (attack === 'skip directory')
      repo.write(
        'scripts/guardrails/policy.mjs',
        readFileSync(policy, 'utf8').replace(
          'export const SKIPPED_DIRECTORY_PARTS = [',
          "export const SKIPPED_DIRECTORY_PARTS = ['src', ",
        ),
      );
    else {
      repo.write('scripts/ci.mjs', 'process.exitCode = 0;\n');
      repo.write('scripts/ci/gates.json', '{"gates":[]}');
      repo.write('.github/workflows/ci.yml', 'jobs: {}\n');
    }
    const head = repo.commit();
    repo.git('reset', '--hard', base);
    const result = spawnSync(process.execPath, ['scripts/ci.mjs', '--range', base, head], {
      cwd: repo.root,
      env: repo.env,
      encoding: 'utf8',
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /src\/feature\.js:1: banned token/);
    assert.equal(repo.git('rev-parse', 'HEAD'), base);
  });
}

test('explicit IDs are validated before Git and base checkout identity is required', (t) => {
  const repo = fixture(t);
  const base = repo.commit();
  for (const args of [['--help', base], [base, '--help'], [base], [base, base, '--help']]) {
    const result = spawnSync(process.execPath, ['scripts/ci.mjs', '--range', ...args], {
      cwd: repo.root,
      env: { ...repo.env, PATH: '' },
      encoding: 'utf8',
    });
    assert.equal(result.status, 2);
    assert.match(
      result.stderr,
      args.length >= 2 ? /Invalid explicit range commit IDs/ : /Expected.*range/,
    );
  }
  repo.write('src/feature.js', 'export const safe = false;\n');
  const head = repo.commit();
  const result = spawnSync(process.execPath, ['scripts/ci.mjs', '--range', base, head], {
    cwd: repo.root,
    env: repo.env,
    encoding: 'utf8',
  });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /checkout.*base/);
});

test('fetch authentication is scoped to the command and never reaches output or config', (t) => {
  assert.deepEqual(
    fetchArguments({
      HEAD_SHA: 'a'.repeat(40),
      BASE_REF: 'feature',
      GITHUB_TOKEN: 'fixture-token',
    }),
    [
      'fetch',
      '--no-tags',
      '--no-recurse-submodules',
      'origin',
      `+${'a'.repeat(40)}:refs/ci/pr-head`,
      '+refs/heads/feature:refs/ci/current-base',
    ],
  );
  assert.deepEqual(
    fetchAuthentication({ GITHUB_SERVER_URL: 'https://github.com', GITHUB_TOKEN: 'fixture-token' }),
    {
      GIT_CONFIG_COUNT: '1',
      GIT_CONFIG_KEY_0: 'http.https://github.com/.extraheader',
      GIT_CONFIG_VALUE_0: 'AUTHORIZATION: basic eC1hY2Nlc3MtdG9rZW46Zml4dHVyZS10b2tlbg==',
    },
  );
  assert.deepEqual(
    fetchAuthentication({
      GITHUB_SERVER_URL: 'https://git.example.test/',
      GITHUB_TOKEN: 'changed',
    }),
    {
      GIT_CONFIG_COUNT: '1',
      GIT_CONFIG_KEY_0: 'http.https://git.example.test/.extraheader',
      GIT_CONFIG_VALUE_0: 'AUTHORIZATION: basic eC1hY2Nlc3MtdG9rZW46Y2hhbmdlZA==',
    },
  );
  for (const url of [
    'http://github.com',
    'https://user:password@github.com',
    'https://github.com/?query=1',
    'https://github.com/#fragment',
    'invalid',
  ]) {
    assert.throws(() =>
      fetchAuthentication({ GITHUB_SERVER_URL: url, GITHUB_TOKEN: 'fixture-token' }),
    );
  }
  for (const head of ['', '42; exit 0', '-42', '0'.repeat(40)]) {
    assert.throws(
      () =>
        fetchArguments({ HEAD_SHA: head, BASE_REF: 'feature', GITHUB_TOKEN: 'fixture-token' }),
      /Invalid pull request head SHA/,
    );
  }
  const remote = fixture(t);
  const base = remote.commit();
  const token = 'inner' + 'HTML';
  remote.write('src/feature.js', `const host = {}; host.${token} = 'x';\n`);
  const head = remote.commit();
  remote.git('reset', '--hard', base);
  const local = repository(t);
  local.git('remote', 'add', 'origin', remote.root);
  local.git('fetch', 'origin', 'feature');
  local.git('reset', '--hard', base);
  const realGit = execFileSync('/usr/bin/which', ['git'], {
    cwd: local.root,
    env: local.env,
    encoding: 'utf8',
  }).trim();
  local.write(
    'bin/git',
    `#!${process.execPath}
import { appendFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
appendFileSync('git-calls.jsonl', JSON.stringify({ args: process.argv.slice(2), count: process.env.GIT_CONFIG_COUNT ?? null, key: process.env.GIT_CONFIG_KEY_0 ?? null, value: process.env.GIT_CONFIG_VALUE_0 ?? null }) + '\\n');
const result = spawnSync(${JSON.stringify(realGit)}, process.argv.slice(2), { env: process.env, stdio: 'inherit' });
process.exitCode = result.status ?? 2;
`,
  );
  chmodSync(join(local.root, 'bin/git'), 0o755);
  const output = join(local.root, 'output.txt');
  local.write(
    'trace-config',
    `[trace2]\n  normalTarget = ${local.root}/normal-trace\n  eventTarget = ${local.root}/global-event-trace\n  perfTarget = ${local.root}/global-perf-trace\n`,
  );
  const env = {
    ...local.env,
    GIT_CONFIG_GLOBAL: join(local.root, 'trace-config'),
    BASE_REF: 'feature',
    HEAD_SHA: head,
    GITHUB_TOKEN: 'fixture-token',
    GITHUB_SERVER_URL: 'https://github.com',
    PATH: `${join(local.root, 'bin')}:${local.env.PATH}`,
    GITHUB_OUTPUT: output,
    GIT_TRACE: '1',
    GIT_TRACE_PERFORMANCE: join(local.root, 'performance-trace'),
    GIT_TRACE2_EVENT: join(local.root, 'event-trace'),
  };
  const fetch = (extra = {}) =>
    spawnSync(process.execPath, ['scripts/ci.mjs', '--fetch'], {
      cwd: local.root,
      env: { ...env, ...extra },
      encoding: 'utf8',
    });
  for (const extra of [
    { HEAD_SHA: '' },
    { HEAD_SHA: '42; exit 0' },
    { HEAD_SHA: '-42' },
    { HEAD_SHA: '0'.repeat(40) },
    { BASE_REF: 'feature; exit 0' },
    { BASE_REF: '--help' },
    { GITHUB_TOKEN: '' },
  ])
    assert.equal(fetch(extra).status, 2);
  const scopedEnv = { ...local.env, ...fetchAuthentication(env) };
  const matching = spawnSync(
    'git',
    ['config', '--get-urlmatch', 'http.extraheader', 'https://github.com/owner/repository'],
    { cwd: local.root, env: scopedEnv, encoding: 'utf8' },
  );
  assert.equal(matching.status, 0);
  assert.equal(
    matching.stdout.trim(),
    'AUTHORIZATION: basic eC1hY2Nlc3MtdG9rZW46Zml4dHVyZS10b2tlbg==',
  );
  const other = spawnSync(
    'git',
    ['config', '--get-urlmatch', 'http.extraheader', 'https://other.example.test/owner/repository'],
    { cwd: local.root, env: scopedEnv, encoding: 'utf8' },
  );
  assert.equal(other.status, 1);
  assert.equal(other.stdout, '');
  const fetched = fetch();
  assert.equal(fetched.status, 0);
  const calls = readFileSync(join(local.root, 'git-calls.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  for (const call of calls) {
    assert.doesNotMatch(
      JSON.stringify(call.args),
      /fixture-token|AUTHORIZATION|Zml4dHVyZS10b2tlbg==|extraheader/,
    );
    if (call.args[0] === 'fetch') {
      assert.deepEqual(
        { count: call.count, key: call.key, value: call.value },
        {
          count: '1',
          key: 'http.https://github.com/.extraheader',
          value: 'AUTHORIZATION: basic eC1hY2Nlc3MtdG9rZW46Zml4dHVyZS10b2tlbg==',
        },
      );
      assert.equal(call.args.includes('--no-recurse-submodules'), true);
    } else
      assert.deepEqual(
        { count: call.count, key: call.key, value: call.value },
        { count: null, key: null, value: null },
      );
  }

  assert.equal(existsSync(join(local.root, 'performance-trace')), false);
  assert.equal(existsSync(join(local.root, 'event-trace')), false);
  assert.equal(existsSync(join(local.root, 'normal-trace')), false);
  assert.equal(existsSync(join(local.root, 'global-event-trace')), false);
  assert.equal(existsSync(join(local.root, 'global-perf-trace')), false);
  assert.equal(local.git('rev-parse', 'refs/ci/pr-head'), head);
  assert.equal(local.git('rev-parse', 'refs/ci/current-base'), base);
  assert.equal(local.git('rev-parse', 'HEAD'), base);
  assert.equal(
    readFileSync(join(local.root, 'src/feature.js'), 'utf8'),
    'export const safe = true;\n',
  );
  assert.equal(readFileSync(output, 'utf8'), `base=${base}\n`);
  for (const text of [
    fetched.stdout,
    fetched.stderr,
    readFileSync(output, 'utf8'),
    readFileSync(join(local.root, '.git/config'), 'utf8'),
  ]) {
    assert.doesNotMatch(
      text,
      /fixture-token|eC1hY2Nlc3MtdG9rZW46Zml4dHVyZS10b2tlbg==|http\.extraheader/,
    );
  }
  local.git('remote', 'set-url', 'origin', join(local.root, 'missing-remote'));
  const failed = fetch();
  assert.equal(failed.status, 2);
  assert.doesNotMatch(
    failed.stdout + failed.stderr,
    /fixture-token|eC1hY2Nlc3MtdG9rZW46Zml4dHVyZS10b2tlbg==/,
  );
});

test('current base merge base excludes additions already merged by a PR with a stale event base', (t) => {
  const repo = fixture(t);
  const base = repo.commit();
  repo.write('src/inherited.js', 'host.' + 'inner' + "HTML = 'base';\n");
  const currentBase = repo.commit();
  repo.write('src/feature.js', 'export const safe = false;\n');
  const head = repo.commit();
  const tree = repo.git('rev-parse', `${currentBase}^{tree}`);
  const laterBase = repo.git('commit-tree', tree, '-p', currentBase, '-m', 'test: later base');
  repo.git('reset', '--hard', base);
  const run = (tip, revision = head) =>
    spawnSync(process.execPath, ['scripts/ci.mjs', '--range', base, revision, tip], {
      cwd: repo.root,
      env: repo.env,
      encoding: 'utf8',
    });
  for (const tip of [currentBase, laterBase]) {
    const result = run(tip);
    assert.equal(result.status, 0);
    assert.doesNotMatch(result.stderr, /inherited\.js/);
  }
  repo.git('reset', '--hard', head);
  repo.write('src/feature.js', 'host.' + 'inner' + "HTML = 'PR';\n");
  const badHead = repo.commit();
  repo.git('reset', '--hard', base);
  const bad = run(laterBase, badHead);
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /src\/feature\.js:1: banned token/);
  assert.doesNotMatch(bad.stderr, /inherited\.js/);
  const unrelated = repo.git('commit-tree', tree, '-m', 'test: unrelated base');
  assert.equal(run(unrelated).status, 2);
});
