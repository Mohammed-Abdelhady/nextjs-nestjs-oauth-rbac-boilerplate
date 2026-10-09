import assert from 'node:assert/strict';
import test, { before } from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { relative, resolve } from 'node:path';
import { declaredWorkspaces, trackedTypeFiles } from './workspace-policy.mjs';

const TYPE = 'a' + 'ny';
const RULE = '@typescript-eslint/no-explicit-' + TYPE;
const ROOT = fileURLToPath(new URL('../../..', import.meta.url));
let LINTER;
before(async () => {
  const WORKSPACE = declaredWorkspaces(ROOT)[0];
  const WORKSPACE_ROOT = resolve(ROOT, WORKSPACE);
  const WORKSPACE_REQUIRE = createRequire(resolve(WORKSPACE_ROOT, 'package.json'));
  const { ESLint } = WORKSPACE_REQUIRE('eslint');
  const tseslint = WORKSPACE_REQUIRE('typescript-eslint');
  const CONFIG = await new ESLint({ cwd: WORKSPACE_ROOT }).calculateConfigForFile(
    resolve(
      ROOT,
      trackedTypeFiles(ROOT, { filesystem: true }).find((file) => file.startsWith(`${WORKSPACE}/`)),
    ),
  );
  LINTER = new ESLint({
    overrideConfigFile: true,
    overrideConfig: [
      ...tseslint.configs.recommended,
      { rules: { [RULE]: CONFIG.rules[RULE] }, linterOptions: CONFIG.linterOptions },
    ],
  });
});
async function lintTypes(source, filePath) {
  const results = await LINTER.lintText(source, { filePath });
  return results.flatMap(({ messages, filePath: resolvedPath }) =>
    messages
      .filter(({ ruleId }) => ruleId === RULE)
      .map((message) => ({
        ...message,
        path: relative(process.cwd(), resolvedPath),
      })),
  );
}

const TYPE_CASES = [
  ['annotation', `const x: ${TYPE} = 1;`, 1],
  ['angle cast', `const x = <${TYPE}>data;`, 1],
  ['array suffix', `const x: ${TYPE}[] = [];`, 1],
  ['array generic', `const x: Array<${TYPE}> = [];`, 1],
  ['record generic', `const x: Record<string, ${TYPE}> = {};`, 1],
  ['alias', `type Value = ${TYPE};`, 1],
  ['union', `type Value = string | ${TYPE};`, 1],
  ['conditional', `type Value<T> = T extends string ? ${TYPE} : unknown;`, 1],
  ['line comment', `// const x: ${TYPE} = 1;`, 0],
  ['block comment', `/* const x: ${TYPE} = 1; */`, 0],
  ['single string', `const x = ': ${TYPE}';`, 0],
  ['double string', `const x = "<${TYPE}>";`, 0],
  ['template text', 'const x = `: ' + TYPE + '`;', 0],
  ['template expression', 'const x = `${null as Array<' + TYPE + '>}`;', 1],
  ['regex', `const x = /${TYPE}[]/;`, 0],
  ['return regex', `function x() { return /${TYPE}/; }`, 0],
  ['arrow regex', `const x = () => /${TYPE}/;`, 0],
  ['control regex', `if (x) /${TYPE}/.test(x);`, 0],
  ['identifier', 'const company = 1;', 0],
  ['keyword property division', `const value = obj.return / fn<${TYPE}>();`, 1],
  ['await property division', `const value = obj.await / fn<${TYPE}>();`, 1],
  ['property', `const x = obj.${TYPE};`, 0],
  ['property declaration', `const x = { ${TYPE}: 1 };`, 0],
];
for (const [name, source, status] of TYPE_CASES) {
  test(`type keyword ${name}`, async () => {
    const result = await lintTypes(source, 'src/probe.ts');
    assert.equal(result.length, status);
  });
}

for (const [name, content, status, hits] of [
  [
    'return regex quote',
    `function x() { return /["']/; }\nconst x: ${TYPE} = 1;\n`,
    1,
    [['src/type.ts', 2]],
  ],
  [
    'arrow regex quote',
    `const x = () => /["']/;\nconst y: ${TYPE} = 1;\n`,
    1,
    [['src/type.ts', 2]],
  ],
  [
    'control regex quote',
    `if (x) /["']/.test(x);\nconst y: ${TYPE} = 1;\n`,
    1,
    [['src/type.ts', 2]],
  ],
  ['multiline generic', `const x: Record<string,\n ${TYPE}> = {};\n`, 1, [['src/type.ts', 2]]],
  ['multiline comment', `/*\nconst x: ${TYPE} = 1;\n*/\n`, 0, []],
  ['multiline string', 'const x = `\n: ' + TYPE + '\n`;\n', 0, []],
]) {
  test(`type keyword ${name}`, async () => {
    const result = await lintTypes(content, 'src/type.ts');
    assert.deepEqual(
      { count: result.length, hits: result.map(({ path, line }) => [path, line]) },
      { count: status, hits },
    );
  });
}

for (const [name, content, status, hits] of [
  [
    'apostrophe text cannot hide a type',
    `const node = <p>Don't change this</p>;\nconst x: ${TYPE} = 1;`,
    1,
    [['src/view.tsx', 2]],
  ],
  [
    'parenthesized text cannot hide a type',
    `const node = <p>(Don't change this)</p>;\nconst x: ${TYPE} = 1;`,
    1,
    [['src/view.tsx', 2]],
  ],
  [
    'generic component text cannot hide a type',
    `const node = <Component<Props>>Don't change this</Component>;\nconst x: ${TYPE} = 1;`,
    1,
    [['src/view.tsx', 2]],
  ],
  [
    'generic component type argument is code',
    `const node = <Component<Array<${TYPE}>> />;`,
    1,
    [['src/view.tsx', 1]],
  ],
  [
    'clean generic arrow cannot hide a later type',
    `const x = <T extends Array<unknown>>(value: T) => value;\nconst y: ${TYPE} = 1;`,
    1,
    [['src/view.tsx', 2]],
  ],
  [
    'generic arrow is code',
    `const x = <T extends Array<${TYPE}>>(value: T) => value;`,
    1,
    [['src/view.tsx', 1]],
  ],
  ['plain text is not a type', `const node = <p>${TYPE} text</p>;`, 0, []],
  [
    'attribute expression is code',
    `const node = <p value={null as Array<${TYPE}>} />;`,
    1,
    [['src/view.tsx', 1]],
  ],
  [
    'nested expression is code',
    `const node = <p><b>Text</b>{null as Array<${TYPE}>}</p>;`,
    1,
    [['src/view.tsx', 1]],
  ],
]) {
  test(`JSX and diff syntax ${name}`, async () => {
    const result = await lintTypes(content, 'src/view.tsx');
    assert.deepEqual(
      { count: result.length, hits: result.map(({ path, line }) => [path, line]) },
      { count: status, hits },
    );
  });
}

for (const [name, content, status, hits] of [
  [
    'component function type',
    `const node = <Component<() => ${TYPE}> />;`,
    1,
    [['src/balanced.tsx', 1]],
  ],
  ['component generic comment', `const node = <Component</* ${TYPE} */ Props> />;`, 0, []],
  [
    'generic arrow nested default',
    `const f = <T extends unknown>(x: T, value = choose()) => x;\nconst x: ${TYPE} = 1;`,
    1,
    [['src/balanced.tsx', 2]],
  ],
]) {
  test(`balanced JSX ${name}`, async () => {
    const result = await lintTypes(content, 'src/balanced.tsx');
    assert.deepEqual(
      { count: result.length, hits: result.map(({ path, line }) => [path, line]) },
      { count: status, hits },
    );
  });
}

for (const [name, source, filePath, expected] of [
  [
    'non-null division',
    `const avg = total! / count; export const leak: ${TYPE} = 1; const pct = a / b;`,
    'src/probe.ts',
    1,
  ],
  [
    'generic function type',
    `type H = <T>(e: T) => void; const leak: ${TYPE} = 1;`,
    'src/view.tsx',
    1,
  ],
  [
    'attribute then apostrophe',
    `const node = <p title="ok">Don't hide this</p>; const leak: ${TYPE} = 1;`,
    'src/view.tsx',
    1,
  ],
  ['rest tuple', `type Tuple = [...${TYPE}[]];`, 'src/probe.ts', 1],
  ['regex after operator', `const r = 1 + /'/.source; const leak: ${TYPE} = 1;`, 'src/probe.ts', 1],
  ['named method', `class C { ${TYPE}() {} }`, 'src/probe.ts', 0],
  ['named property', `class C { ${TYPE}: string = ''; }`, 'src/probe.ts', 0],
  ['named variable', `const ${TYPE} = 1;`, 'src/probe.ts', 0],
  ['named type export', `export type { ${TYPE} };`, 'src/probe.ts', 0],
  ['named import', `import { ${TYPE} } from './value';`, 'src/probe.ts', 0],
  ['named enum member', `enum E { ${TYPE} }`, 'src/probe.ts', 0],
  ['named private field', `class C { #${TYPE} = 1; }`, 'src/probe.ts', 0],
  ['dollar identifier', `const $${TYPE} = 1;`, 'src/probe.ts', 0],
  ['regex type text', `const r = 1 + /${TYPE}/.source;`, 'src/probe.ts', 0],
]) {
  test(`parser regression ${name}`, async () => {
    assert.equal((await lintTypes(source, filePath)).length, expected);
  });
}

test('inline configuration cannot disable the parser type rule', async () => {
  const result = await lintTypes(
    '/* es' + 'lint ' + RULE + ': "off" */\nexport const value: ' + TYPE + ' = 1;',
    'src/probe.ts',
  );
  assert.equal(result.length, 1);
});
