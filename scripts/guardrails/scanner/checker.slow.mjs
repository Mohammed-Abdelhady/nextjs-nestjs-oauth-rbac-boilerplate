import assert from 'node:assert/strict';
import test from 'node:test';
import { repository, outcome } from '../test-repository.mjs';

const DOM_NAME = 'inner' + 'HTML';
const TYPE = 'a' + 'ny';
const BAD = `node.${DOM_NAME} = value;\n`;
const CLEAN = 'export const value = 1;\n';

for (const filePath of [
  'nested/check-hard-bans.mjs',
  'nested/check-hard-bans.test.mjs',
  'scripts\\guardrails\\policy.mjs',
]) {
  test(`basename collision is refused: ${filePath}`, (t) => {
    const repo = repository(t);
    repo.write(filePath, `node.${DOM_NAME} = value;\n`);
    repo.git('add', '.');
    assert.deepEqual(outcome(repo.check('--staged')), {
      status: 1,
      hits: [[filePath, 1, DOM_NAME]],
      caps: [],
    });
  });
}

const DENIAL_CASES = [
  ['literal name', `expect(source).not.toContain('${DOM_NAME}');`, 0],
  ['match literal', `expect(source).not.toMatch("${DOM_NAME}");`, 0],
  ['real receiver', `expect(node.${DOM_NAME}).not.toContain('x');`, 1],
  ['use and denial', `node.${DOM_NAME} = x; expect(source).not.toContain('${DOM_NAME}');`, 1],
  ['bracket use', `node['${DOM_NAME}'] = x; expect(source).not.toContain('${DOM_NAME}');`, 1],
  ['two occurrences', `expect(source).not.toContain('${DOM_NAME}'); node.${DOM_NAME} = x;`, 1],
  ['other ban', `const x = data as ${TYPE}; expect(source).not.toContain('${DOM_NAME}');`, 1],
  ['concatenated argument', `expect(source).not.toContain('${DOM_NAME}' + 'x');`, 1],
  ['fake matcher string', `const text = "expect(source).not.toContain('${DOM_NAME}');";`, 1],
];
for (const [name, source, status] of DENIAL_CASES) {
  test(`denial ${name}`, (t) => {
    const repo = repository(t);
    repo.write('src/view.test.ts', source);
    repo.git('add', '.');
    assert.deepEqual(outcome(repo.check('--staged')), {
      status,
      hits:
        status === 1
          ? [['src/view.test.ts', 1, name === 'other ban' ? ['as', TYPE].join(' ') : DOM_NAME]]
          : [],
      caps: [],
    });
  });
}
test('denial literal in product code is refused', (t) => {
  const repo = repository(t);
  repo.write('src/view.ts', `expect(source).not.toContain('${DOM_NAME}');`);
  repo.git('add', '.');
  assert.deepEqual(outcome(repo.check('--staged')), {
    status: 1,
    hits: [['src/view.ts', 1, DOM_NAME]],
    caps: [],
  });
});

test('staged mode ignores bad unstaged content and its length', (t) => {
  const repo = repository(t);
  repo.write('backend/src/partial.ts', CLEAN);
  repo.git('add', '.');
  repo.write('backend/src/partial.ts', CLEAN + BAD.repeat(351));
  assert.deepEqual(outcome(repo.check('--staged')), { status: 0, hits: [], caps: [] });
});

test('staged content is refused even when worktree is clean', (t) => {
  const repo = repository(t);
  repo.write('src/partial.ts', BAD);
  repo.git('add', '.');
  repo.write('src/partial.ts', CLEAN);
  assert.deepEqual(outcome(repo.check('--staged')), {
    status: 1,
    hits: [['src/partial.ts', 1, DOM_NAME]],
    caps: [],
  });
});

test('full scan includes new files and ignores removed files and binaries', (t) => {
  const repo = repository(t);
  repo.write('gone.ts', CLEAN);
  repo.commit();
  repo.git('rm', 'gone.ts');
  repo.write('new.ts', BAD);
  repo.write(
    'frontend/src/binary.png',
    Buffer.concat([Buffer.from([0, 255, 1]), Buffer.from(BAD.repeat(351))]),
  );
  assert.deepEqual(outcome(repo.check('--all')), {
    status: 1,
    hits: [['new.ts', 1, DOM_NAME]],
    caps: [],
  });
});

const LEGACY_BANS = [
  'dangerously' + 'SetInnerHTML',
  'insertAdj' + 'acentHTML',
  'eslint-disab' + 'le-next-line',
  'eslint-di' + 'sable-line',
  '@Suppres' + 'sWarnings',
  'as unk' + 'nown as',
  'satisf' + 'ies any',
  'prettie' + 'r-ignore',
  'deno-lin' + 't-ignore',
  'oxlint-' + 'disable',
  'stylelin' + 't-disable',
  'biome-' + 'ignore',
  'eslint-' + 'disable',
  'eslint' + '-enable',
  'documen' + 't.write',
  '--no-ty' + 'pecheck',
  '--no-' + 'eslint',
  '--no-' + 'verify',
  '@ts-expe' + 'ct-error',
  '@ts-n' + 'ocheck',
  '@ts-i' + 'gnore',
  'type: ' + 'ignore',
  'pylint:' + ' disable',
  'ruff:' + ' noqa',
  '# n' + 'oqa',
  'as ' + 'any',
  'oute' + 'rHTML',
  'inne' + 'rHTML',
];

for (const filePath of [
  'src/policy.ts',
  'src/policy.tsx',
  'src/policy.js',
  'src/policy.jsx',
  'src/policy.mjs',
  'src/policy.cjs',
  'scripts/policy.sh',
  'package.json',
  '.husky/pre-commit',
]) {
  test(`all legacy constructs stay banned in ${filePath}`, (t) => {
    const repo = repository(t);
    repo.write(filePath, LEGACY_BANS.join('\n'));
    repo.git('add', '.');
    assert.deepEqual(outcome(repo.check('--staged')), {
      status: 1,
      hits: [
        [filePath, 1, LEGACY_BANS[0]],
        [filePath, 2, LEGACY_BANS[1]],
        [filePath, 3, LEGACY_BANS[2]],
        [filePath, 4, LEGACY_BANS[3]],
        [filePath, 5, LEGACY_BANS[4]],
        [filePath, 6, LEGACY_BANS[5]],
        [filePath, 7, LEGACY_BANS[6]],
        [filePath, 8, LEGACY_BANS[7]],
        [filePath, 9, LEGACY_BANS[8]],
        [filePath, 10, LEGACY_BANS[9]],
        [filePath, 11, LEGACY_BANS[10]],
        [filePath, 12, LEGACY_BANS[11]],
        [filePath, 13, LEGACY_BANS[12]],
        [filePath, 14, LEGACY_BANS[13]],
        [filePath, 15, LEGACY_BANS[14]],
        [filePath, 16, LEGACY_BANS[15]],
        [filePath, 17, LEGACY_BANS[16]],
        [filePath, 18, LEGACY_BANS[17]],
        [filePath, 19, LEGACY_BANS[18]],
        [filePath, 20, LEGACY_BANS[19]],
        [filePath, 21, LEGACY_BANS[20]],
        [filePath, 22, LEGACY_BANS[21]],
        [filePath, 23, LEGACY_BANS[22]],
        [filePath, 24, LEGACY_BANS[23]],
        [filePath, 25, LEGACY_BANS[24]],
        [filePath, 26, LEGACY_BANS[25]],
        [filePath, 27, LEGACY_BANS[26]],
        [filePath, 28, LEGACY_BANS[27]],
      ],
      caps: [],
    });
  });
}

test('diff header-like added content is refused', (t) => {
  const repo = repository(t);
  repo.write('src/view.tsx', `++ node.${DOM_NAME};`);
  repo.git('add', '.');
  assert.deepEqual(outcome(repo.check('--staged')), {
    status: 1,
    hits: [['src/view.tsx', 1, DOM_NAME]],
    caps: [],
  });
});
