import assert from 'node:assert/strict';
import test from 'node:test';
import { repository, outcome } from '../test-repository.mjs';

const TOKEN = 'inner' + 'HTML';
const BAD = `node.${TOKEN} = value;\n`;
const CAST = ['as', 'unknown', 'as'].join(' ');
const INLINE = 'inline eslint configuration';

for (const path of [
  'src/x\\dist\\evil.ts',
  'src/evil.TS',
  'src/evil.JS',
  'src/evil.mts',
  'src/evil.cts',
  'src/evil.mjs',
  'frontend/src/.env.MTS',
]) {
  test(`source spelling is scanned literally: ${path}`, (t) => {
    const repo = repository(t);
    repo.write(path, BAD);
    repo.git('add', '.');
    assert.deepEqual(outcome(repo.check('--staged')), {
      status: 1,
      hits: [[path, 1, TOKEN]],
      caps: [],
    });
  });
}

for (const token of ['@ts-expe' + 'ct-error', '@ts-i' + 'gnore', '@ts-n' + 'ocheck']) {
  test(`glued TypeScript directive is refused: ${token}`, (t) => {
    const repo = repository(t);
    repo.write('src/a.ts', `// ${token}Because legacy typing\nexport {};\n`);
    repo.git('add', '.');
    assert.deepEqual(outcome(repo.check('--staged')), {
      status: 1,
      hits: [['src/a.ts', 1, token]],
      caps: [],
    });
  });
}

for (const [content, token, allowed = false] of [
  ['document' + '.writeln("x")', 'document' + '.writeln'],
  ['document' + '?.write("x")', 'document' + '?.write'],
  ['document' + "['write']('x')", 'document' + "['write']"],
  ['document' + '["write"]("x")', 'document' + '["write"]'],
  ['export const x = 1 as unk' + 'nown  as string;', CAST],
  ['export const x = 1 as unk' + 'nown\tas string;', CAST],
  ['export const x = 1 as unk' + 'nown/* comment */as string;', CAST],
  ['export const x = 1 as unk' + 'nown /* first */ /* second */ as string;', CAST],
  ['/* es' + 'lint @typescript-eslint/no-explicit-' + 'a' + 'ny: "off" */', INLINE],
  ['// es' + 'lint @typescript-eslint/no-explicit-' + 'a' + 'ny: 0', INLINE, true],
  ['/*\teslint\tno-alert: 0 */', INLINE],
]) {
  test(`additional token spelling is ${allowed ? 'allowed' : 'refused'}: ${content}`, (t) => {
    const repo = repository(t);
    repo.write('src/a.ts', content);
    repo.git('add', '.');
    assert.deepEqual(outcome(repo.check('--staged')), {
      status: allowed ? 0 : 1,
      hits: allowed ? [] : [['src/a.ts', 1, token]],
      caps: [],
    });
  });
}

for (const path of ['backend/test/app/app.e2e-spec.ts', 'backend/src/auth/a.harness-spec.ts']) {
  test(`repository test suffix grants strict denial: ${path}`, (t) => {
    const repo = repository(t);
    repo.write(path, `expect(source).not.toContain('${TOKEN}');`);
    repo.git('add', '.');
    assert.deepEqual(outcome(repo.check('--staged')), { status: 0, hits: [], caps: [] });
  });
}

test('a harness suffix in a directory grants no denial', (t) => {
  const repo = repository(t);
  repo.write('src/a.harness-spec.ts/helper.ts', `expect(source).not.toContain('${TOKEN}');`);
  repo.git('add', '.');
  assert.deepEqual(outcome(repo.check('--staged')), {
    status: 1,
    hits: [['src/a.harness-spec.ts/helper.ts', 1, TOKEN]],
    caps: [],
  });
});

for (const [tail, hits] of [
  ['as string;', [['src/comments.ts', 1, CAST]]],
  [';', []],
]) {
  test(`comment-separated cast preserves the second-cast boundary: ${tail}`, (t) => {
    const repo = repository(t);
    repo.write(
      'src/comments.ts',
      'export const value = 1 as unk' + 'nown ' + '/* closed */ '.repeat(500) + tail,
    );
    repo.git('add', '.');
    assert.deepEqual(outcome(repo.check('--staged')), {
      status: hits.length ? 1 : 0,
      hits,
      caps: [],
    });
  });
}

test('nested-looking cast openers inside one block comment remain allowed', (t) => {
  const repo = repository(t);
  repo.write('src/comments.ts', '/* outer ' + ('as unk' + 'nown /* ').repeat(16000) + '*/');
  repo.git('add', '.');
  assert.deepEqual(outcome(repo.check('--staged')), { status: 0, hits: [], caps: [] });
});

test('an overlapping comment opener and closer is not a cast separator', (t) => {
  const repo = repository(t);
  repo.write('src/comments.ts', "export const label = 'as unk" + "nown/*/as string';");
  repo.git('add', '.');
  assert.deepEqual(outcome(repo.check('--staged')), { status: 0, hits: [], caps: [] });
});

test('a valid comment after an overlapping pseudo-closer retains the cast ban', (t) => {
  const repo = repository(t);
  repo.write('src/comments.ts', 'export const value = 1 as unk' + 'nown/*/ text */as string;');
  repo.git('add', '.');
  assert.deepEqual(outcome(repo.check('--staged')), {
    status: 1,
    hits: [['src/comments.ts', 1, CAST]],
    caps: [],
  });
});
