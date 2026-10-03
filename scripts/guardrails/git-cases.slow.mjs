import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdirSync, unlinkSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { repository, outcome } from './test-repository.mjs';

const TOKEN = 'inner' + 'HTML';
const BAD = `node.${TOKEN} = value;\n`;
const CLEAN = 'export const value = 1;\n';

for (const path of [
  'frontend/src/.aws/evil.ts',
  'frontend/src/.env.ts',
  'frontend/src/.env.local/x.tsx',
]) {
  test(`protected-looking source remains scanned: ${path}`, (t) => {
    const repo = repository(t);
    repo.write(path, BAD + CLEAN.repeat(350));
    repo.git('add', '.');
    assert.deepEqual(outcome(repo.check('--staged')), {
      status: 1,
      hits: [[path, 1, TOKEN]],
      caps: [[path, 351]],
    });
  });
}

test('a symlink changed into a regular source file is checked', (t) => {
  const repo = repository(t);
  repo.write('target.txt', CLEAN);
  symlinkSync('target.txt', join(repo.root, 'link.ts'));
  repo.commit();
  unlinkSync(join(repo.root, 'link.ts'));
  repo.write('link.ts', BAD);
  repo.git('add', '.');
  assert.deepEqual(outcome(repo.check('--staged')), {
    status: 1,
    hits: [['link.ts', 1, TOKEN]],
    caps: [],
  });
});

for (const mode of ['--staged', '--all']) {
  test(`${mode} works from a nested working directory`, (t) => {
    const repo = repository(t);
    repo.write('frontend/src/file.ts', CLEAN);
    repo.commit();
    repo.write('frontend/src/file.ts', BAD + CLEAN.repeat(350));
    repo.git('add', '.');
    assert.deepEqual(outcome(repo.checkAt(join(repo.root, 'frontend'), mode)), {
      status: 1,
      hits: [['frontend/src/file.ts', 1, TOKEN]],
      caps: [['frontend/src/file.ts', 351]],
    });
  });
}

for (const extension of ['png', 'PNG', 'bmp', 'tiff', 'svg']) {
  test(`non-source images do not enter the blob batch: ${extension}`, (t) => {
    const repo = repository(t);
    repo.write(
      `frontend/src/assets/hero.${extension}`,
      Buffer.concat([Buffer.from(BAD.repeat(351)), Buffer.alloc(1_500_000, 65)]),
    );
    repo.git('add', '.');
    assert.deepEqual(outcome(repo.check('--staged')), { status: 0, hits: [], caps: [] });
  });
}

test('large source blobs are checked without the default child-process buffer limit', (t) => {
  const repo = repository(t);
  repo.write('public/vendor.js', '// ' + 'x'.repeat(1_500_000) + '\n' + BAD);
  repo.git('add', '.');
  assert.deepEqual(outcome(repo.check('--staged')), {
    status: 1,
    hits: [['public/vendor.js', 2, TOKEN]],
    caps: [],
  });
});

for (const path of ['backend/src/vendor', 'vendor.js']) {
  test(`gitlink objects are not read as source: ${path}`, (t) => {
    const repo = repository(t);
    repo.write('base.txt', CLEAN);
    repo.commit();
    repo.git(
      'update-index',
      '--add',
      '--cacheinfo',
      `160000,1111111111111111111111111111111111111111,${path}`,
    );
    assert.deepEqual(outcome(repo.check('--staged')), { status: 0, hits: [], caps: [] });
  });
}

test('a pruned upstream falls back to the default-remote merge base', (t) => {
  const repo = repository(t);
  repo.write('base.ts', CLEAN);
  const base = repo.commit();
  repo.git('update-ref', 'refs/remotes/origin/staging', base);
  repo.git('symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/staging');
  repo.git('config', 'remote.origin.url', 'https://example.invalid/fixture.git');
  repo.git('config', 'remote.origin.fetch', '+refs/heads/*:refs/remotes/origin/*');
  repo.git('config', 'branch.feature.remote', 'origin');
  repo.git('config', 'branch.feature.merge', 'refs/heads/pruned');
  repo.write('src/new.ts', BAD);
  repo.commit();
  assert.deepEqual(outcome(repo.check('--push')), {
    status: 1,
    hits: [['src/new.ts', 1, TOKEN]],
    caps: [],
  });
});

for (const path of ['src/[ab].ts', 'src/*.ts', ':x.ts', '1:x.ts']) {
  test(`Git source paths stay literal: ${path}`, (t) => {
    const repo = repository(t);
    repo.write(path, BAD);
    repo.write('src/a.ts', CLEAN);
    repo.git('add', '--', '.');
    assert.deepEqual(outcome(repo.check('--staged')), {
      status: 1,
      hits: [[path, 1, TOKEN]],
      caps: [],
    });
  });
}

for (const path of [
  'scripts/guardrails/checker.mjs',
  'scripts/guardrails/checker.test.mjs',
  'scripts/guardrails/ranges.test.mjs',
  'scripts/check-hard-bans.mjs',
]) {
  test(`checker logic has no data exemption: ${path}`, (t) => {
    const repo = repository(t);
    repo.write(path, '// ' + ['eslint', 'disable'].join('-'));
    repo.git('add', '.');
    assert.deepEqual(outcome(repo.check('--staged')), {
      status: 1,
      hits: [[path, 1, ['eslint', 'disable'].join('-')]],
      caps: [],
    });
  });
}

for (const old of [
  'evil.txt',
  'frontend/src/evil.txt',
  'dist/a.ts',
  'scripts/guardrails/policy.mjs',
]) {
  test(`rename into scan scope rechecks all content from ${old}`, (t) => {
    const repo = repository(t);
    repo.write(old, BAD + CLEAN.repeat(10));
    const base = repo.commit();
    mkdirSync(join(repo.root, 'frontend/src'), { recursive: true });
    repo.git('mv', old, 'frontend/src/new.ts');
    const head = repo.commit();
    assert.deepEqual(outcome(repo.check('--range', base, head)), {
      status: 1,
      hits: [['frontend/src/new.ts', 1, TOKEN]],
      caps: [],
    });
  });
}

for (const binary of ['attribute', 'NUL']) {
  test(`binary source cannot bypass bans or ceilings: ${binary}`, (t) => {
    const repo = repository(t);
    if (binary === 'attribute') repo.write('.gitattributes', '*.ts -diff\n');
    repo.write(
      'frontend/src/a.ts',
      BAD + (binary === 'NUL' ? '// \0\n' : CLEAN) + CLEAN.repeat(349),
    );
    repo.git('add', '.');
    assert.deepEqual(outcome(repo.check('--staged')), {
      status: 1,
      hits: [['frontend/src/a.ts', 1, TOKEN]],
      caps: [['frontend/src/a.ts', 351]],
    });
  });
}

test('a mode-only oversized source change is refused', (t) => {
  const repo = repository(t);
  repo.write('backend/src/large.ts', CLEAN.repeat(351));
  repo.commit();
  repo.git('update-index', '--chmod=+x', 'backend/src/large.ts');
  assert.deepEqual(outcome(repo.check('--staged')), {
    status: 1,
    hits: [],
    caps: [['backend/src/large.ts', 351]],
  });
});

test('CR-only source lines count toward the ceiling', (t) => {
  const repo = repository(t);
  repo.write('backend/src/cr.ts', 'export {};\r'.repeat(351));
  repo.git('add', '.');
  assert.deepEqual(outcome(repo.check('--staged')), {
    status: 1,
    hits: [],
    caps: [['backend/src/cr.ts', 351]],
  });
});

test('outside a repository produces one error line', (t) => {
  const repo = repository(t);
  const result = spawnSync(process.execPath, [repo.entry, '--staged'], {
    cwd: join(repo.root, '..'),
    env: repo.env,
    encoding: 'utf8',
  });
  assert.deepEqual(
    { status: result.status, lines: result.stderr.trim().split('\n').length },
    { status: 2, lines: 1 },
  );
});

for (const path of [
  'backend/src/.config/gcloud/configurations/config_default',
  'backend/src/.ssh/nested/config',
]) {
  test(`nested credential files stay unread: ${path}`, (t) => {
    const repo = repository(t);
    repo.write(path, BAD + CLEAN.repeat(350));
    repo.git('add', '.');
    assert.deepEqual(outcome(repo.check('--staged')), { status: 0, hits: [], caps: [] });
  });
}

test('mixed type, rename and modified patches retain their own paths', (t) => {
  const repo = repository(t);
  repo.write('target.txt', CLEAN);
  symlinkSync('target.txt', join(repo.root, 'a.ts'));
  repo.write('b.ts', CLEAN);
  repo.write('c.ts', CLEAN);
  repo.commit();
  unlinkSync(join(repo.root, 'a.ts'));
  repo.write('a.ts', BAD);
  repo.git('mv', 'b.ts', 'renamed.ts');
  repo.write('c.ts', CLEAN + BAD);
  repo.git('add', '.');
  assert.deepEqual(outcome(repo.check('--staged')), {
    status: 1,
    hits: [
      ['a.ts', 1, TOKEN],
      ['c.ts', 2, TOKEN],
    ],
    caps: [],
  });
});

for (const path of ['src/[ab].ts', 'src/*.ts']) {
  test(`a glob-named file cannot inherit a sibling's added line: ${path}`, (t) => {
    const repo = repository(t);
    repo.write(path, CLEAN);
    repo.write('src/a.ts', CLEAN + BAD);
    repo.git('add', '.');
    assert.deepEqual(outcome(repo.check('--staged')), {
      status: 1,
      hits: [['src/a.ts', 2, TOKEN]],
      caps: [],
    });
  });
}

test('a rename out of a test filename rechecks denial exemptions', (t) => {
  const repo = repository(t);
  repo.write('src/old.test.ts', `expect(props).not.toContain('${TOKEN}');\n`);
  const base = repo.commit();
  repo.git('mv', 'src/old.test.ts', 'src/new.ts');
  const head = repo.commit();
  assert.deepEqual(outcome(repo.check('--range', base, head)), {
    status: 1,
    hits: [['src/new.ts', 1, TOKEN]],
    caps: [],
  });
});

test('batch scans support native SHA-256 object identifiers', (t) => {
  const repo = repository(t, ['--object-format=sha256']);
  repo.write('src/a.ts', BAD);
  repo.git('add', '.');
  assert.deepEqual(outcome(repo.check('--staged')), {
    status: 1,
    hits: [['src/a.ts', 1, TOKEN]],
    caps: [],
  });
});
