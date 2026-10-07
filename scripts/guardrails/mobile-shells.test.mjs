import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const EXACT_VERSION = /^\d+\.\d+\.\d+$/;
const SHARED_RUNTIME = [
  'expo', 'expo-crypto', 'expo-file-system', 'expo-linking', 'expo-secure-store',
  'expo-web-browser', 'react', 'react-dom', 'react-native',
];
const REACT_NATIVE_TOOLING = [
  '@react-native/babel-preset', '@react-native/metro-config', '@react-native/typescript-config',
];
const REACT_DOM_PAIR = /react-dom@(\d+\.\d+\.\d+)\(react@(\d+\.\d+\.\d+)\)/g;
const TYPESCRIPT_PACKAGE = /^  typescript@(\d+\.\d+\.\d+):$/gm;
/** Scoped to the range Expo suggests today, so a new suggestion is checked again. */
const EXPO_CHECK_EXCLUSIONS = ['typescript@~6.0.3'];
const readManifest = (workspace) =>
  JSON.parse(readFileSync(join(ROOT, workspace, 'package.json'), 'utf8'));

/** Pure so the rules can be shown failing without touching the real manifests. */
export function shellSkewProblems(expo, cli) {
  const problems = [];
  for (const name of SHARED_RUNTIME) {
    const versions = [expo.dependencies?.[name], cli.dependencies?.[name]];
    if (!versions.every((version) => EXACT_VERSION.test(version ?? ''))) {
      problems.push(`${name} is not pinned to an exact version in both shells`);
    } else if (versions[0] !== versions[1]) {
      problems.push(`${name} differs between the shells: ${versions.join(' and ')}`);
    }
  }
  for (const [label, { dependencies = {} }] of [['Expo', expo], ['bare', cli]]) {
    if (dependencies['react-dom'] !== dependencies.react) {
      problems.push(`react-dom does not match react ${dependencies.react} in the ${label} shell`);
    }
  }
  const reactNative = cli.dependencies?.['react-native'];
  for (const name of REACT_NATIVE_TOOLING) {
    if (cli.devDependencies?.[name] !== reactNative) {
      problems.push(`${name} does not match react-native ${reactNative}`);
    }
  }
  return problems;
}

/** A react-dom linked against another React version throws when it renders. */
export function mismatchedReactDom(lockfile) {
  const pairs = [...lockfile.matchAll(REACT_DOM_PAIR)]
    .filter(([, reactDom, react]) => reactDom !== react)
    .map(([pair]) => pair);
  return [...new Set(pairs)].sort();
}

/** The shells stay on the repository's TypeScript and say so to Expo's version check. */
export function typeScriptProblems({ shells, repositoryRange, lockfile }) {
  const problems = [];
  for (const [label, manifest] of Object.entries(shells)) {
    const excluded = manifest.expo?.install?.exclude ?? [];
    if (JSON.stringify(excluded) !== JSON.stringify(EXPO_CHECK_EXCLUSIONS)) {
      problems.push(`the ${label} shell excludes [${excluded.join(', ')}] from the Expo check`);
    }
    if (manifest.devDependencies?.typescript !== repositoryRange) {
      problems.push(`the ${label} shell does not use TypeScript ${repositoryRange}`);
    }
  }
  const installed = [...new Set([...lockfile.matchAll(TYPESCRIPT_PACKAGE)].map(([, v]) => v))];
  if (installed.length !== 1) {
    problems.push(`the lockfile holds ${installed.length} TypeScript versions: ${installed.sort().join(', ')}`);
  }
  return problems;
}

const shell = (dependencies, devDependencies = {}) => ({ dependencies, devDependencies });
const typed = (exclude, typescript = '^5.9.3') => ({
  devDependencies: { typescript },
  ...(exclude ? { expo: { install: { exclude } } } : {}),
});
const ONE_TYPESCRIPT = 'packages:\n\n  typescript@5.9.3:\n    resolution: {}\n';
const RUNTIME = {
  expo: '57.0.26', 'expo-crypto': '57.0.3', 'expo-file-system': '57.0.7',
  'expo-linking': '57.0.11', 'expo-secure-store': '57.0.4', 'expo-web-browser': '57.0.3',
  react: '19.2.3', 'react-dom': '19.2.3', 'react-native': '0.86.3',
};
const TOOLING = {
  '@react-native/babel-preset': '0.86.3', '@react-native/metro-config': '0.86.3',
  '@react-native/typescript-config': '0.86.3',
};

test('the two mobile shells pin one React, React Native and Expo module set', () => {
  assert.deepEqual(shellSkewProblems(readManifest('mobile/expo'), readManifest('mobile/cli')), []);
});

test('the lockfile links every react-dom against its own React version', () => {
  assert.deepEqual(mismatchedReactDom(readFileSync(join(ROOT, 'pnpm-lock.yaml'), 'utf8')), []);
});

test('matching exact pins and tooling pass', () => {
  assert.deepEqual(shellSkewProblems(shell(RUNTIME), shell(RUNTIME, TOOLING)), []);
});

test('a patch of difference in React Native between the shells is reported', () => {
  const cli = shell({ ...RUNTIME, 'react-native': '0.86.4' }, {
    '@react-native/babel-preset': '0.86.4', '@react-native/metro-config': '0.86.4',
    '@react-native/typescript-config': '0.86.4' });

  assert.deepEqual(shellSkewProblems(shell(RUNTIME), cli), [
    'react-native differs between the shells: 0.86.3 and 0.86.4',
  ]);
});

for (const range of ['^57.0.26', '~57.0.26', '57.0', 'latest', 'workspace:*']) {
  test(`an Expo version written as ${range} is reported as unpinned`, () => {
    const loose = { ...RUNTIME, expo: range };

    assert.deepEqual(shellSkewProblems(shell(loose), shell(loose, TOOLING)), [
      'expo is not pinned to an exact version in both shells',
    ]);
  });
}

test('a module missing from one shell is reported', () => {
  const { 'expo-crypto': _removed, ...withoutCrypto } = RUNTIME;

  assert.deepEqual(shellSkewProblems(shell(RUNTIME), shell(withoutCrypto, TOOLING)), [
    'expo-crypto is not pinned to an exact version in both shells',
  ]);
});

test('a react-dom from another React line is reported in each shell', () => {
  const web = { ...RUNTIME, 'react-dom': '19.3.0' };

  assert.deepEqual(shellSkewProblems(shell(web), shell(web, TOOLING)), [
    'react-dom does not match react 19.2.3 in the Expo shell',
    'react-dom does not match react 19.2.3 in the bare shell',
  ]);
});

test('bare tooling that lags React Native is reported', () => {
  const tooling = { ...TOOLING, '@react-native/metro-config': '0.85.2' };

  assert.deepEqual(shellSkewProblems(shell(RUNTIME), shell(RUNTIME, tooling)), [
    '@react-native/metro-config does not match react-native 0.86.3',
  ]);
});

test('a shell with no dependencies at all is reported, not skipped', () => {
  assert.equal(shellSkewProblems({}, {}).length, 9);
});

test('a react-dom linked against another React is found once per pair', () => {
  const lockfile = [
    "  expo@55.0.0(react-dom@19.3.0(react@19.2.0))(react@19.2.0):",
    '  react-dom@19.3.0(react@19.2.0):',
    '  react-dom@19.3.0(react@19.3.0):',
    '  react-dom@19.2.3(react@19.2.3):',
    "  '@floating-ui/react-dom@2.1.9(react-dom@19.3.0(react@19.3.0))(react@19.3.0)':",
  ].join('\n');

  assert.deepEqual(mismatchedReactDom(lockfile), ['react-dom@19.3.0(react@19.2.0)']);
});

test('a lockfile with no react-dom has nothing to report', () => {
  assert.deepEqual(mismatchedReactDom('  react@19.2.3:\n  react-native@0.86.3:\n'), []);
});

test('both shells stay on the one TypeScript the repository installs', () => {
  assert.deepEqual(
    typeScriptProblems({
      shells: { Expo: readManifest('mobile/expo'), bare: readManifest('mobile/cli') },
      repositoryRange: readManifest('mobile/auth').devDependencies.typescript,
      lockfile: readFileSync(join(ROOT, 'pnpm-lock.yaml'), 'utf8'),
    }),
    [],
  );
});

const checkTypeScript = (shells, lockfile = ONE_TYPESCRIPT) =>
  typeScriptProblems({ shells, repositoryRange: '^5.9.3', lockfile });

test('a scoped TypeScript exclusion on the repository version passes', () => {
  const scoped = typed(['typescript@~6.0.3']);

  assert.deepEqual(checkTypeScript({ Expo: scoped, bare: scoped }), []);
});

for (const [name, exclude, listed] of [
  ['no exclusion', undefined, ''],
  ['an exclusion that never expires', ['typescript'], 'typescript'],
  ['a second excluded package', ['typescript@~6.0.3', 'react'], 'typescript@~6.0.3, react'],
  ['an exclusion for another range', ['typescript@^6.0.0'], 'typescript@^6.0.0'],
]) {
  test(`a shell with ${name} is reported`, () => {
    const shells = { Expo: typed(['typescript@~6.0.3']), bare: typed(exclude) };

    assert.deepEqual(checkTypeScript(shells), [
      `the bare shell excludes [${listed}] from the Expo check`,
    ]);
  });
}

test('a shell that takes its own TypeScript is reported with the second compiler', () => {
  const lockfile = `${ONE_TYPESCRIPT}\n  typescript@6.0.3:\n    resolution: {}\n`;
  const shells = {
    Expo: typed(['typescript@~6.0.3'], '~6.0.3'),
    bare: typed(['typescript@~6.0.3']),
  };

  assert.deepEqual(checkTypeScript(shells, lockfile), [
    'the Expo shell does not use TypeScript ^5.9.3',
    'the lockfile holds 2 TypeScript versions: 5.9.3, 6.0.3',
  ]);
});

test('a lockfile without TypeScript is reported, not passed', () => {
  const scoped = typed(['typescript@~6.0.3']);

  assert.deepEqual(checkTypeScript({ Expo: scoped, bare: scoped }, 'packages:\n'), [
    'the lockfile holds 0 TypeScript versions: ',
  ]);
});
