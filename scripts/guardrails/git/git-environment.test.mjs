import assert from 'node:assert/strict';
import test from 'node:test';
import { gitEnvironment } from './git-environment.mjs';

for (const variable of [
  'GIT_DIR',
  'GIT_WORK_TREE',
  'GIT_INDEX_FILE',
  'GIT_PREFIX',
  'GIT_COMMON_DIR',
  'GIT_OBJECT_DIRECTORY',
  'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  'GIT_NAMESPACE',
  'GIT_CEILING_DIRECTORIES',
  'GIT_SHALLOW_FILE',
  'GIT_GRAFT_FILE',
  'GIT_REPLACE_REF_BASE',
  'GIT_QUARANTINE_PATH',
  'GIT_CONFIG',
  'GIT_CONFIG_PARAMETERS',
  'GIT_CONFIG_COUNT',
  'GIT_IMPLICIT_WORK_TREE',
  'GIT_NO_REPLACE_OBJECTS',
]) {
  const configuration = ['GIT_CONFIG', 'GIT_CONFIG_PARAMETERS', 'GIT_CONFIG_COUNT'].includes(
    variable,
  );
  test(`explicit Git environment ${configuration ? 'preserves' : 'clears'} ${variable}`, () => {
    const result = gitEnvironment({ [variable]: 'decoy-repository-value' });
    if (configuration) assert.equal(result[variable], 'decoy-repository-value');
    else assert.equal(Object.hasOwn(result, variable), false);
  });
}

test('explicit Git environment preserves unrelated path and user configuration', () => {
  const result = gitEnvironment({
    PATH: '/fixture/bin',
    GIT_CONFIG_GLOBAL: '/fixture/user-git-config',
    GIT_DIR: 'decoy-directory',
  });
  assert.deepEqual(result, {
    PATH: '/fixture/bin',
    GIT_CONFIG_GLOBAL: '/fixture/user-git-config',
  });
});

test('explicit Git environment does not mutate caller input', () => {
  const source = {
    GIT_DIR: 'decoy-directory',
    GIT_INDEX_FILE: 'decoy-index',
    PATH: '/fixture/bin',
  };
  gitEnvironment(source);
  assert.deepEqual(source, {
    GIT_DIR: 'decoy-directory',
    GIT_INDEX_FILE: 'decoy-index',
    PATH: '/fixture/bin',
  });
});

test('alternate index is reintroduced only from the explicit option', () => {
  const result = gitEnvironment(
    { GIT_INDEX_FILE: 'inherited-index' },
    { indexFile: '/fixture/partial-index' },
  );
  assert.deepEqual(result, { GIT_INDEX_FILE: '/fixture/partial-index' });
});

test('an empty alternate-index option cannot retain the inherited index', () => {
  const result = gitEnvironment({ GIT_INDEX_FILE: 'inherited-index' }, { indexFile: '' });
  assert.deepEqual(result, {});
});

test('counted configuration preserves numbered permission keys and values', () => {
  const result = gitEnvironment({
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: 'safe.directory',
    GIT_CONFIG_VALUE_0: '/fixture/repository',
  });
  assert.deepEqual(result, {
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: 'safe.directory',
    GIT_CONFIG_VALUE_0: '/fixture/repository',
  });
});
