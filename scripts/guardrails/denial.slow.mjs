import assert from 'node:assert/strict';
import test from 'node:test';
import { repository, outcome } from './test-repository.mjs';
const TOKEN = 'inner' + 'HTML';

for (const [name, path, content, expected] of [
  [
    'compound test filename',
    'src/a.test.helper.ts',
    `expect(props).not.toContain('${TOKEN}');`,
    [],
  ],
  [
    'regex join bypass',
    'src/a.test.ts',
    `expect(/\\(/) || expect(/\\)/).not.toContain('${TOKEN}');`,
    [['src/a.test.ts', 1, TOKEN]],
  ],
  ['quoted separators', 'src/a.test.ts', `expect('a;b/(').not.toContain('${TOKEN}');`, []],
  [
    'template receiver',
    'src/a.test.ts',
    'expect(`safe`).not.toContain("' + TOKEN + '");',
    [['src/a.test.ts', 1, TOKEN]],
  ],
  [
    'quoted join bypass',
    'src/a.test.ts',
    `expect('(') || expect(')').not.toContain('${TOKEN}');`,
    [['src/a.test.ts', 1, TOKEN]],
  ],
  ['quoted receiver', 'src/a.test.ts', `expect(')').not.toContain('${TOKEN}');`, []],
  ['escaped receiver', 'src/a.test.ts', `expect("a\\\")").not.toContain('${TOKEN}');`, []],
  [
    'two expectations',
    'src/a.test.ts',
    `expect(x).not.toContain('x'); expect(y).not.toContain('${TOKEN}');`,
    [['src/a.test.ts', 1, TOKEN]],
  ],
  [
    'extra statement',
    'src/a.test.ts',
    `expect(x); ordinaryCall(); expect(y).not.toContain('${TOKEN}');`,
    [['src/a.test.ts', 1, TOKEN]],
  ],
  [
    'joined expectation',
    'src/a.test.ts',
    `expect(x) || expect(y).not.toContain('${TOKEN}');`,
    [['src/a.test.ts', 1, TOKEN]],
  ],
  ['exact literal', 'src/a.test.ts', `expect(Object.keys(props)).not.toContain('${TOKEN}');`, []],
  ['double quote', 'src/a.spec.ts', `  expect(props).not.toMatch("${TOKEN}")  `, []],
  [
    'regex bypass',
    'src/a.test.ts',
    `const r = 1 + /'/.source; '.not.toContain('; el.${TOKEN} = x; ')'; // '`,
    [['src/a.test.ts', 1, TOKEN]],
  ],
  [
    'non-null bypass',
    'src/a.test.ts',
    `const r = n! / 2; '.not.toContain('; el.${TOKEN} = x; ')'; const q = 1 / 2;`,
    [['src/a.test.ts', 1, TOKEN]],
  ],
  [
    'directory name',
    'src/a.test.d/hook.ts',
    `expect(props).not.toContain('${TOKEN}');`,
    [['src/a.test.d/hook.ts', 1, TOKEN]],
  ],
  [
    'spec directory',
    'src/a.spec.dir/b.ts',
    `expect(props).not.toContain('${TOKEN}');`,
    [['src/a.spec.dir/b.ts', 1, TOKEN]],
  ],
  [
    'wrapped assertion',
    'src/a.test.ts',
    `expect(props).not.toContain(\n  '${TOKEN}',\n);`,
    [['src/a.test.ts', 2, TOKEN]],
  ],
  [
    'extra comment',
    'src/a.test.ts',
    `expect(props).not.toContain('${TOKEN}'); // proof`,
    [['src/a.test.ts', 1, TOKEN]],
  ],
  [
    'partial string',
    'src/a.test.ts',
    `expect(props).not.toContain('<div ${TOKEN}=');`,
    [['src/a.test.ts', 1, TOKEN]],
  ],
  [
    'duplicate name',
    'src/a.test.ts',
    `expect('${TOKEN}').not.toContain('${TOKEN}');`,
    [['src/a.test.ts', 1, TOKEN]],
  ],
]) {
  test(`strict denial ${name}`, (t) => {
    const repo = repository(t);
    repo.write(path, content);
    repo.git('add', '.');
    assert.deepEqual(outcome(repo.check('--staged')), {
      status: expected.length ? 1 : 0,
      hits: expected,
      caps: [],
    });
  });
}
