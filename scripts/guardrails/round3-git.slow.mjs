import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { repository, outcome } from './test-repository.mjs';

const TOKEN = 'inner' + 'HTML';
const BAD = `node.${TOKEN} = value;\n`;
const CLEAN = 'export const value = 1;\n';
const DIFF_MODULE = new URL('./git-diff.mjs', import.meta.url).href;
const BLOB_MODULE = new URL('./repository-git.mjs', import.meta.url).href;

for (const mode of ['log', 'diff']) {
  test(`gitlinks cannot shift later patches under submodule ${mode}`, (t) => {
    const repo = repository(t);
    repo.write('backend/src/a.ts', CLEAN);
    repo.commit();
    repo.git('config', 'diff.submodule', mode);
    repo.git(
      'update-index',
      '--add',
      '--cacheinfo',
      '160000,1111111111111111111111111111111111111111,backend/src/vendor',
    );
    repo.write('backend/src/b.ts', BAD);
    repo.write('backend/src/z.ts', BAD);
    repo.git('add', 'backend/src/b.ts', 'backend/src/z.ts');
    assert.deepEqual(outcome(repo.check('--staged')), {
      status: 1,
      hits: [
        ['backend/src/b.ts', 1, TOKEN],
        ['backend/src/z.ts', 1, TOKEN],
      ],
      caps: [],
    });
  });
}

test('incomplete patch framing fails closed for real Git metadata', (t) => {
  const repo = repository(t);
  repo.write('src/a.ts', BAD);
  repo.git('add', '.');
  const result = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `
    import { execFileSync } from 'node:child_process';
    import { parseRawPatch } from ${JSON.stringify(DIFF_MODULE)};
    const raw = execFileSync('git', ['diff', '--cached', '--raw', '-z', '--no-abbrev'], { encoding: 'utf8' });
    try { parseRawPatch(raw, { requirePatches: true }); process.exitCode = 0; }
    catch { process.exitCode = 2; }
  `,
    ],
    { cwd: repo.root, env: repo.env, encoding: 'utf8' },
  );
  assert.equal(result.status, 2);
});

test('batch header refuses a real tree object where a blob is required', (t) => {
  const repo = repository(t);
  repo.write('src/a.ts', CLEAN);
  repo.commit();
  const oid = repo.git('rev-parse', 'HEAD^{tree}');
  const result = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `
    import { readBlobs } from ${JSON.stringify(BLOB_MODULE)};
    try { readBlobs([{ oid: '${oid}' }]); process.exitCode = 0; }
    catch { process.exitCode = 2; }
  `,
    ],
    { cwd: repo.root, env: repo.env, encoding: 'utf8' },
  );
  assert.equal(result.status, 2);
});

for (const extension of ['otf', 'webm', 'wasm', 'wav', 'lottie', 'eot', 'heic', 'bin']) {
  test(`binary asset is not capped: ${extension}`, (t) => {
    const repo = repository(t);
    const bytes = Buffer.alloc(200000);
    for (let index = 0; index < bytes.length; index += 1) bytes[index] = (index * 7919) % 256;
    repo.write(`frontend/src/assets/data.${extension}`, bytes);
    repo.git('add', '.');
    assert.deepEqual(outcome(repo.check('--staged')), { status: 0, hits: [], caps: [] });
    assert.deepEqual(outcome(repo.check('--all')), { status: 0, hits: [], caps: [] });
  });
}

for (const [offset, caps] of [
  [7999, []],
  [8000, [['frontend/src/data.txt', 351]]],
]) {
  test(`binary probe boundary at byte ${offset}`, (t) => {
    const repo = repository(t);
    const bytes = Buffer.from('x'.repeat(8001) + '\n'.repeat(351));
    bytes[offset] = 0;
    repo.write('frontend/src/data.txt', bytes);
    repo.git('add', '.');
    assert.deepEqual(outcome(repo.check('--staged')), {
      status: caps.length ? 1 : 0,
      hits: [],
      caps,
    });
  });
}

test('message catalogue data has no file ceiling', (t) => {
  const repo = repository(t);
  repo.write('frontend/src/i18n/messages/en.json', '1\n'.repeat(958));
  repo.commit();
  repo.write('frontend/src/i18n/messages/en.json', '2\n'.repeat(959));
  repo.git('add', '.');
  assert.deepEqual(outcome(repo.check('--staged')), { status: 0, hits: [], caps: [] });
  assert.deepEqual(outcome(repo.check('--all')), { status: 0, hits: [], caps: [] });
});

test('large tracked tree does not enter the diff argument list', (t) => {
  const repo = repository(t);
  for (let dir = 0; dir < 300; dir += 1) {
    const directory = join(
      repo.root,
      'src',
      'a-rather-long-directory-name-for-feature-modules',
      `a-rather-long-directory-name-for-feature-modules-${dir}`,
    );
    mkdirSync(directory, { recursive: true });
    for (let index = 0; index < 100; index += 1)
      writeFileSync(join(directory, `component-file-${index}.service.ts`), CLEAN);
  }
  repo.git('add', '.');
  assert.deepEqual(outcome(repo.check('--staged')), { status: 0, hits: [], caps: [] });
  repo.commit();
  repo.write('src/new.ts', CLEAN);
  repo.git('add', '.');
  assert.deepEqual(outcome(repo.check('--staged')), { status: 0, hits: [], caps: [] });
  repo.write('src/new.ts', CLEAN + BAD);
  repo.git('add', '.');
  assert.deepEqual(outcome(repo.check('--staged')), {
    status: 1,
    hits: [['src/new.ts', 2, TOKEN]],
    caps: [],
  });
});

test('hostile diff config preserves paths and token checks', (t) => {
  const repo = repository(t);
  repo.write('frontend/src/a.ts', CLEAN);
  repo.commit();
  repo.write('frontend/src/a.ts', CLEAN + BAD);
  repo.write('backend/src/b.ts', BAD);
  repo.write('.gitattributes', '*.ts diff=hostile\n');
  repo.write('fake-diff.sh', '#!/bin/sh\nexit 0\n');
  repo.git('config', 'diff.external', `sh ${join(repo.root, 'fake-diff.sh')}`);
  repo.git('config', 'diff.hostile.textconv', `sh ${join(repo.root, 'fake-diff.sh')}`);
  repo.git('config', 'diff.noprefix', 'true');
  repo.git('config', 'diff.mnemonicprefix', 'true');
  repo.git('config', 'diff.relative', 'true');
  repo.git('add', '.');
  assert.deepEqual(outcome(repo.checkAt(join(repo.root, 'frontend'), '--staged')), {
    status: 1,
    hits: [
      ['backend/src/b.ts', 1, TOKEN],
      ['frontend/src/a.ts', 2, TOKEN],
    ],
    caps: [],
  });
});

for (const content of [
  'const a = 1;\rconst b = 2;\r' + BAD.trim() + '\rconst c = 3;\r',
  'const a = 1;\rconst b = 2;\n' + BAD,
]) {
  test(`diff reports logical CR line numbers: ${JSON.stringify(content)}`, (t) => {
    const repo = repository(t);
    repo.write('src/cr.ts', content);
    repo.git('add', '.');
    assert.deepEqual(outcome(repo.check('--staged')), {
      status: 1,
      hits: [['src/cr.ts', 3, TOKEN]],
      caps: [],
    });
  });
}

test('long banned lines have bounded excerpts', (t) => {
  const repo = repository(t);
  repo.write('src/long.ts', BAD.trim() + 'x'.repeat(200000));
  repo.git('add', '.');
  const result = repo.check('--staged');
  assert.deepEqual(
    { ...outcome(result), bounded: result.diagnostic.length < 400 },
    {
      status: 1,
      hits: [['src/long.ts', 1, TOKEN]],
      caps: [],
      bounded: true,
    },
  );
});

test('Git output over the bound names the 64 MiB limit', (t) => {
  const repo = repository(t);
  repo.write('public/big.js', 'x'.repeat(65 * 1024 * 1024));
  repo.git('add', '.');
  const result = repo.check('--staged');
  assert.deepEqual(
    {
      status: result.status,
      boundNamed: result.diagnostic.includes('64 MiB'),
      lines: result.diagnostic.trim().split('\n').length,
    },
    { status: 2, boundNamed: true, lines: 1 },
  );
});

test('E2BIG from inherited environment gives actionable one-line failure', (t) => {
  const repo = repository(t);
  const result = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `
    import { git } from ${JSON.stringify(BLOB_MODULE)};
    try { git(['status'], { env: { ...process.env, GUARDRAILS_TEST_PADDING: 'x'.repeat(4_000_000) } }); }
    catch (error) { console.error(error.message); process.exitCode = 2; }
  `,
    ],
    { cwd: repo.root, env: repo.env, encoding: 'utf8' },
  );
  assert.deepEqual(
    {
      status: result.status,
      actionable: result.stderr.includes('inherited environment'),
      lines: result.stderr.trim().split('\n').length,
    },
    { status: 2, actionable: true, lines: 1 },
  );
});

test('binary probe uses bytes with a multibyte text prefix', (t) => {
  const repo = repository(t);
  repo.write(
    'frontend/src/utf8.txt',
    Buffer.concat([
      Buffer.from('é'.repeat(4000)),
      Buffer.from([0]),
      Buffer.from('x\n'.repeat(351)),
    ]),
  );
  repo.git('add', '.');
  assert.deepEqual(outcome(repo.check('--staged')), {
    status: 1,
    hits: [],
    caps: [['frontend/src/utf8.txt', 351]],
  });
});
