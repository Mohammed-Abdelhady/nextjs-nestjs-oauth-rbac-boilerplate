import assert from 'node:assert/strict';
import test from 'node:test';
import {
  evaluateChanges,
  findBannedToken,
  isContentTarget,
  isScanTarget,
} from '../../check-hard-bans.mjs';

const FLAGS = ['verify', 'typecheck', 'eslint'].map((name) => `--no-${name}`);
const STYLE = ['stylelint', 'disable'].join('-');
const LINT = ['eslint', 'disable'].join('-');
const TYPE = 'a' + 'ny';
const CAST = `as ${TYPE}`;
const CHECK = `satisfies ${TYPE}`;
const COMMAND_FILES = [
  '.github/workflows/ci.yml',
  'docker-compose.yaml',
  'backend/config/SETTINGS.YML',
  'backend/Dockerfile',
  'frontend/Dockerfile.dev',
];
const STYLE_FILES = ['frontend/src/app/globals.css', 'frontend/public/PRINT.CSS'];

function scan(path, text) {
  return evaluateChanges({ added: [{ path, addedLines: [{ line: 7, text }] }], lineCounts: [] });
}

for (const path of COMMAND_FILES) {
  for (const flag of FLAGS) {
    test(`${path} is refused with ${flag}`, () => {
      const text = `run: git commit ${flag} -m release`;
      assert.deepEqual(scan(path, text), {
        bans: [{ path, line: 7, token: flag, text }],
        caps: [],
        ok: false,
      });
    });
  }

  test(`${path} passes without a bypass flag`, () => {
    assert.equal(isContentTarget(path), true);
    assert.deepEqual(scan(path, 'run: pnpm run lint --no-cache'), { bans: [], caps: [], ok: true });
  });

  test(`${path} is read for bypass flags only`, () => {
    assert.equal(isScanTarget(path), false);
    assert.deepEqual(scan(path, `# ${STYLE} and ${LINT} and x ${CAST}`), {
      bans: [],
      caps: [],
      ok: true,
    });
  });
}

for (const path of STYLE_FILES) {
  for (const directive of [STYLE, `${STYLE}-next-line`, `${STYLE}-line`]) {
    test(`${path} is refused with ${directive}`, () => {
      const text = `/* ${directive} color-no-hex */`;
      assert.deepEqual(scan(path, text), {
        bans: [{ path, line: 7, token: STYLE, text }],
        caps: [],
        ok: false,
      });
    });
  }

  test(`${path} passes without a directive and is read for that directive only`, () => {
    assert.equal(isContentTarget(path), true);
    assert.equal(isScanTarget(path), false);
    assert.deepEqual(scan(path, '.button { color: red; }'), { bans: [], caps: [], ok: true });
    assert.deepEqual(scan(path, `/* ${FLAGS[0]} ${LINT} */`), { bans: [], caps: [], ok: true });
  });
}

for (const path of [
  'node_modules/tool/Dockerfile',
  'frontend/node_modules/tool/ci.yml',
  'frontend/.next/static/app.css',
  'docs/NotDockerfile',
  'docs/dockerfile-notes.txt',
  'docs/pipeline.yml.md',
  'config/.env.yml',
]) {
  test(`${path} is not read`, () => {
    assert.equal(isContentTarget(path), false);
    assert.deepEqual(scan(path, `run: git commit ${FLAGS[0]} /* ${STYLE} */`), {
      bans: [],
      caps: [],
      ok: true,
    });
  });
}

test('the policy file and the scanner fixture stay exempt', () => {
  for (const path of [
    'scripts/guardrails/policy.mjs',
    'scripts/guardrails/scanner/check-hard-bans.test.mjs',
  ]) {
    assert.deepEqual(scan(path, `const x = y ${CAST}; // ${FLAGS[0]}`), {
      bans: [],
      caps: [],
      ok: true,
    });
  }
});

const SEPARATORS = [
  ['one space', ' '],
  ['two spaces', '  '],
  ['a tab', '\t'],
  ['a comment between spaces', ' /* x */ '],
  ['a comment and no space', '/* x */'],
  ['two comments', ' /* x */ /* y */ '],
  ['a comment that holds a star', ' /* a * b */ '],
];

for (const [name, separator] of SEPARATORS) {
  test(`the type cast is refused across ${name}`, () => {
    assert.equal(findBannedToken(`const value = data as${separator}${TYPE};`), CAST);
    assert.equal(findBannedToken(`const rows = list as${separator}${TYPE}[];`), CAST);
  });

  test(`the type check is refused across ${name}`, () => {
    assert.equal(findBannedToken(`const value = data satisfies${separator}${TYPE};`), CHECK);
  });
}

for (const text of [
  `const value = data as ${TYPE}thing;`,
  `const value = data as  ${TYPE}Of;`,
  `const value = data satisfies ${TYPE}Of;`,
  `const value = data satisfies\t${TYPE}thing;`,
  `// the user has  ${TYPE} of the roles`,
  `const canvas /* x */ ${TYPE}where = 1;`,
  `const value = data as /* open ${TYPE};`,
  `const value = data as${TYPE};`,
  `const value = data as unknown;`,
]) {
  test(`no type escape is reported for: ${text}`, () => {
    assert.equal(findBannedToken(text), null);
  });
}
