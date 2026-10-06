import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { repository, outcome } from './test-repository.mjs';
import { gitEnvironment } from './git-environment.mjs';

const TOKEN = 'inner' + 'HTML';
const CAST = 'as unk' + 'nown as';
const BAD = `node.${TOKEN} = value;\n`;
const CLEAN = 'export const value = 1;\n';

for (const encoding of ['LE', 'BE']) {
  for (const mode of ['--staged', '--all']) {
    test(`UTF-16 ${encoding} source is checked in ${mode}`, (t) => {
      const repo = repository(t);
      const bytes = Buffer.from('\ufeff' + CLEAN + BAD, 'utf16le');
      repo.write('backend/src/encoded.ts', encoding === 'BE' ? bytes.swap16() : bytes);
      repo.git('add', '.');
      assert.deepEqual(outcome(repo.check(mode)), {
        status: 1,
        hits: [['backend/src/encoded.ts', 2, TOKEN]],
        caps: [],
      });
    });
  }
}

for (const [source, hits] of [
  ['export const value = <string>(<unk' + 'nown>input);', [['src/assertion.ts', 1, CAST]]],
  ['export const value = (input as unk' + 'nown) as string;', [['src/assertion.ts', 1, CAST]]],
  ['export const value = input as  unk' + 'nown as string;', [['src/assertion.ts', 1, CAST]]],
  ['export const value = <unk' + 'nown>input;', []],
  ['export const value = (input as unk' + 'nown);', []],
]) {
  test(`cast spelling preserves the single-cast boundary: ${source}`, (t) => {
    const repo = repository(t);
    repo.write('src/assertion.ts', source);
    repo.git('add', '.');
    assert.deepEqual(outcome(repo.check('--staged')), {
      status: hits.length ? 1 : 0,
      hits,
      caps: [],
    });
  });
}

for (const extension of ['snap', 'css', 'CSS']) {
  test(`data or style file ${extension} has no source ceiling`, (t) => {
    const repo = repository(t);
    repo.write(`frontend/src/data.${extension}`, CLEAN.repeat(351));
    repo.git('add', '.');
    assert.deepEqual(outcome(repo.check('--staged')), { status: 0, hits: [], caps: [] });
    assert.deepEqual(outcome(repo.check('--all')), { status: 0, hits: [], caps: [] });
  });
}

for (const tail of ['', 'x'.repeat(1000)]) {
  test(`a minified excerpt centres the actual banned token: trailing bytes ${tail.length}`, (t) => {
    const repo = repository(t);
    repo.write('src/minified.ts', 'x'.repeat(2000) + ';' + BAD.trim() + tail);
    repo.git('add', '.');
    const result = repo.check('--staged');
    const excerpt = result.diagnostic.split(': banned token ')[1]?.split(': ').slice(1).join(': ');
    assert.deepEqual(
      {
        ...outcome(result),
        tokenVisible: excerpt?.includes(TOKEN),
        bounded: result.diagnostic.length < 400,
      },
      {
        status: 1,
        hits: [['src/minified.ts', 1, TOKEN]],
        caps: [],
        tokenVisible: true,
        bounded: true,
      },
    );
  });
}

test('an unmaterialisable tracked path warns once while scanning reachable files', (t) => {
  const repo = repository(t);
  repo.write('package.json', '{}');
  repo.write('src/value.ts', BAD);
  repo.git('add', '.');
  const oid = execFileSync('git', ['hash-object', '-w', '--stdin'], {
    cwd: repo.root,
    env: gitEnvironment(repo.env),
    input: CLEAN,
    encoding: 'utf8',
  }).trim();
  repo.git('update-index', '--add', '--cacheinfo', `100644,${oid},${'x'.repeat(5000)}.ts`);
  const result = repo.check('--all');
  assert.deepEqual(
    {
      ...outcome(result),
      warnings: result.diagnostic.split('\n').filter((line) => /warning/i.test(line)).length,
    },
    { status: 1, hits: [['src/value.ts', 1, TOKEN]], caps: [], warnings: 1 },
  );
});

test('an edited rename keeps inherited lines under a low rename limit', (t) => {
  const repo = repository(t);
  repo.write('src/a.ts', BAD + CLEAN.repeat(30));
  repo.write('src/b.ts', CLEAN.repeat(30) + 'export const second = 2;\n');
  const base = repo.commit();
  repo.git('config', 'diff.renameLimit', '1');
  repo.git('mv', 'src/a.ts', 'src/c.ts');
  repo.git('mv', 'src/b.ts', 'src/d.ts');
  repo.write('src/c.ts', BAD + CLEAN.repeat(30) + 'export const third = 3;\n');
  repo.write('src/d.ts', CLEAN.repeat(30) + 'export const second = 2;\nexport const fourth = 4;\n');
  const head = repo.commit();
  assert.deepEqual(outcome(repo.check('--range', base, head)), { status: 0, hits: [], caps: [] });
});

for (const encoding of ['LE', 'BE']) {
  test(`UTF-16 ${encoding} range retains added-lines-only semantics`, (t) => {
    const repo = repository(t);
    const old = Buffer.from('\ufeff' + BAD, 'utf16le');
    repo.write('src/encoded.ts', encoding === 'BE' ? old.swap16() : old);
    const base = repo.commit();
    const next = Buffer.from('\ufeff' + BAD + CLEAN, 'utf16le');
    repo.write('src/encoded.ts', encoding === 'BE' ? next.swap16() : next);
    const head = repo.commit();
    assert.deepEqual(outcome(repo.check('--range', base, head)), { status: 0, hits: [], caps: [] });
  });
}
