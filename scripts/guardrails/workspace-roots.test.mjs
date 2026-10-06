import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { repository } from './test-repository.mjs';
import test from 'node:test';

for (const [name, manifest, expected] of [
  ['array', '{"workspaces":["apps/*"]}', '["","apps/one"]'],
  ['object', '{"workspaces":{"packages":["apps/*"]}}', '["","apps/one"]'],
  ['missing key', '{}', '[""]'],
  ['malformed', '{', '[""]'],
  ['missing file', null, '[""]'],
  ['unreadable file', 'directory', '[""]'],
  ['invalid metadata', '{"workspaces":"bad"}', '[""]'],
]) {
  test(`workspace discovery handles ${name} and emits one warning only on read/parse failure`, (t) => {
    const repo = repository(t);
    if (manifest === 'directory') repo.write('package.json/entry', '{}');
    else if (manifest !== null) repo.write('package.json', manifest);
    repo.write('apps/one/package.json', '{}');
    const script =
      "import { scannerWorkspaceRoots } from './.guardrails-runner/guardrails/workspace-roots.mjs'; console.log(JSON.stringify(scannerWorkspaceRoots(process.cwd()))); scannerWorkspaceRoots(process.cwd());";
    const result = spawnSync(process.execPath, ['--input-type=module', '--eval', script], {
      cwd: repo.root,
      env: repo.env,
      encoding: 'utf8',
    });
    assert.equal(result.status, 0);
    assert.equal(result.stdout.trim(), expected);
    if (['malformed', 'missing file', 'unreadable file', 'invalid metadata'].includes(name)) {
      assert.equal(result.stderr.trim().split('\n').length, 1);
      assert.match(
        result.stderr,
        /^Guardrails warning:.*package\.json.*repository-root exclusions only\.\n$/,
      );
    } else assert.equal(result.stderr, '');
  });
}
