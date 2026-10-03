import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync } from 'node:fs';
import { join } from 'node:path';
import { gitEnvironment } from './git-environment.mjs';
import { repository } from './test-repository.mjs';

const TOKEN = 'inner' + 'HTML';
const ENV_MODULE = new URL('./git-environment.mjs', import.meta.url).href;

test('missing external Git patch data fails at the staged call boundary', (t) => {
  const repo = repository(t);
  repo.write('src/value.ts', `node.${TOKEN} = value;\n`);
  repo.git('add', '.');
  const executable = execFileSync('which', ['git'], {
    cwd: repo.root,
    env: repo.env,
    encoding: 'utf8',
  }).trim();
  repo.write(
    'bin/git',
    `#!${process.execPath}
import { execFileSync } from 'node:child_process';
import { gitEnvironment } from ${JSON.stringify(ENV_MODULE)};
const args = process.argv.slice(2);
let output = execFileSync(${JSON.stringify(executable)}, args, { cwd: process.cwd(), env: gitEnvironment() });
if (args.includes('--patch')) {
  const start = output.indexOf(Buffer.from('diff --git '));
  if (start >= 0) output = output.subarray(0, start);
}
process.stdout.write(output);
`,
  );
  chmodSync(join(repo.root, 'bin/git'), 0o755);
  const result = spawnSync(process.execPath, [repo.entry, '--staged'], {
    cwd: repo.root,
    env: gitEnvironment({ ...repo.env, PATH: `${join(repo.root, 'bin')}:${repo.env.PATH}` }),
    encoding: 'utf8',
  });
  assert.deepEqual(
    {
      status: result.status,
      mismatch: result.stderr.includes('patch count'),
      lines: result.stderr.trim().split('\n').length,
    },
    { status: 2, mismatch: true, lines: 1 },
  );
});
