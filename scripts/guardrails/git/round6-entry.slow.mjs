import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { symlinkSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { repository } from '../test-repository.mjs';

const TOKEN = 'inner' + 'HTML';
const CLEAN = 'export const value = 1;\n';

function alias(repo, kind) {
  if (kind === 'directory') {
    const directory = join(repo.root, 'runner-alias');
    symlinkSync(dirname(repo.entry), directory, 'dir');
    return join(directory, 'check-hard-bans.mjs');
  }
  const entry = join(repo.root, 'entry-alias.mjs');
  symlinkSync(repo.entry, entry);
  return entry;
}

function run(repo, entry, args, nodeArgs = []) {
  const result = spawnSync(process.execPath, [...nodeArgs, entry, ...args], {
    cwd: repo.root,
    env: repo.env,
    encoding: 'utf8',
  });
  return {
    status: result.status,
    diagnostic: result.stderr,
    hits: [
      ...result.stderr.matchAll(
        /^(?:\[[a-f0-9]+\] )?(.+?):(\d+): banned token "((?:\\.|[^"\\])*)"/gm,
      ),
    ].map((match) => [match[1], Number(match[2]), JSON.parse(`"${match[3]}"`)]),
  };
}

for (const kind of ['directory', 'file']) {
  for (const mode of ['--staged', '--all', '--range']) {
    test(`${kind} entry symlink dispatches ${mode} to the real checker`, (t) => {
      const repo = repository(t);
      repo.write('src/a.ts', CLEAN);
      const base = repo.commit();
      repo.write('src/a.ts', CLEAN + `node.${TOKEN} = value;\n`);
      repo.git('add', '.');
      const entry = alias(repo, kind);
      const args = mode === '--range' ? [mode, base, repo.commit()] : [mode];
      const result = run(repo, entry, args);
      assert.deepEqual(
        { status: result.status, hits: result.hits },
        {
          status: 1,
          hits: [['src/a.ts', 2, TOKEN]],
        },
      );
      if (kind === 'file' && mode !== '--staged')
        assert.match(
          result.diagnostic,
          /^(?:\[[a-f0-9]+\] )?entry-alias\.mjs:1: Source symlinks are refused; commit a regular source file\.$/m,
        );
    });
  }

  test(`${kind} entry symlink refuses unknown flags`, (t) => {
    const repo = repository(t);
    const result = run(repo, alias(repo, kind), ['--bogus']);
    assert.deepEqual(
      {
        status: result.status,
        lines: result.diagnostic.trim().split('\n').filter(Boolean).length,
        hits: result.hits,
      },
      { status: 2, lines: 1, hits: [] },
    );
  });

  test(`importing the ${kind} entry symlink exposes the API without dispatch`, (t) => {
    const repo = repository(t);
    repo.write('src/a.ts', `node.${TOKEN} = value;\n`);
    repo.git('add', '.');
    const entry = alias(repo, kind);
    repo.write(
      'importer.mjs',
      `import { main } from ${JSON.stringify(pathToFileURL(entry).href)};\n` +
        'console.log(typeof main);\n',
    );
    const result = spawnSync(process.execPath, [join(repo.root, 'importer.mjs'), '--staged'], {
      cwd: repo.root,
      env: repo.env,
      encoding: 'utf8',
    });
    assert.deepEqual(
      { status: result.status, output: result.stdout, diagnostic: result.stderr },
      { status: 0, output: 'function\n', diagnostic: '' },
    );
  });
}

for (const inputKind of ['stdin', 'eval']) {
  test(`${inputKind} module import exposes the API without dispatch`, (t) => {
    const repo = repository(t);
    const program = `import { main } from ${JSON.stringify(pathToFileURL(repo.entry).href)}; console.log(typeof main);`;
    const args =
      inputKind === 'stdin' ? ['--input-type=module', '-'] : ['--input-type=module', '-e', program];
    const result = spawnSync(process.execPath, args, {
      cwd: repo.root,
      env: repo.env,
      encoding: 'utf8',
      input: program,
    });
    assert.deepEqual(
      { status: result.status, output: result.stdout, diagnostic: result.stderr },
      { status: 0, output: 'function\n', diagnostic: '' },
    );
  });
}

for (const mode of ['--staged', '--bogus']) {
  test(`preserved directory alias resolves both entry paths for ${mode}`, (t) => {
    const repo = repository(t);
    repo.write('src/a.ts', `node.${TOKEN} = value;\n`);
    repo.git('add', '.');
    const result = run(repo, alias(repo, 'directory'), [mode], ['--preserve-symlinks-main']);
    if (mode === '--staged') {
      assert.deepEqual(
        { status: result.status, hits: result.hits },
        { status: 1, hits: [['src/a.ts', 1, TOKEN]] },
      );
    } else {
      assert.deepEqual(
        {
          status: result.status,
          lines: result.diagnostic.trim().split('\n').filter(Boolean).length,
          hits: result.hits,
        },
        { status: 2, lines: 1, hits: [] },
      );
    }
  });
}
