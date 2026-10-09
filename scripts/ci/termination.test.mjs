import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { installChecker } from '../guardrails/test-repository.mjs';

for (const [signal, status] of [
  ['SIGTERM', 143],
  ['SIGINT', 130],
]) {
  test(`forwards ${signal} to the gate process group and waits for cleanup`, async (t) => {
    const cwd = mkdtempSync(join(tmpdir(), 'ci-termination-'));
    installChecker(cwd, { directory: 'scripts' });
    mkdirSync(join(cwd, 'scripts/ci'), { recursive: true });
    for (const file of [
      'ci.mjs',
      'ci/runner.mjs',
      'ci/range.mjs',
      'ci/event-range.mjs',
      'ci/cache.mjs',
      'ci/fetch.mjs',
      'ci/fetch.mjs',
    ])
      copyFileSync(new URL(`../${file}`, import.meta.url), join(cwd, 'scripts', file));
    const leaf = `
      const fs = require('node:fs');
      process.on('message', () => {});
      process.on('${signal}', () => { fs.writeFileSync('leaf.txt', '${signal}'); process.exit(0); });
      console.log('READY ' + process.pid);
    `;
    const gate = `
      const { spawn } = require('node:child_process');
      const fs = require('node:fs');
      process.on('${signal}', () => { fs.writeFileSync('gate.txt', '${signal}'); process.exit(0); });
      spawn(process.execPath, ['-e', ${JSON.stringify(leaf)}], { stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
    `;
    writeFileSync(
      join(cwd, 'scripts/ci/gates.json'),
      JSON.stringify({
        gates: [
          { name: 'gate', command: 'node', args: ['-e', gate] },
          {
            name: 'later',
            command: 'node',
            args: ['-e', "require('node:fs').writeFileSync('later.txt', 'ran')"],
          },
        ],
      }),
    );
    const parent = spawn(process.execPath, ['scripts/ci.mjs'], {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let leafPid;
    t.after(() => {
      parent.kill('SIGKILL');
      if (leafPid) {
        try {
          process.kill(leafPid, 'SIGKILL');
        } catch {}
      }
      rmSync(cwd, { recursive: true, force: true });
    });
    let output = '';
    const ready = new Promise((resolve, reject) => {
      parent.once('error', reject);
      parent.once('exit', () => reject(new Error('Entry point exited before the gate was ready')));
      parent.stdout.on('data', (chunk) => {
        output += chunk;
        const match = output.match(/READY (\d+)/);
        if (match) {
          leafPid = Number(match[1]);
          resolve();
        }
      });
    });
    // Wait on the exit event instead of close, so a broken parent cannot hang on inherited pipes.
    const exited = once(parent, 'exit');
    const closed = once(parent, 'close');
    await ready;
    parent.kill(signal);
    const [code, terminatedBy] = await exited;
    assert.equal(code, status);
    assert.equal(terminatedBy, null);
    assert.equal(readFileSync(join(cwd, 'gate.txt'), 'utf8'), signal);
    await closed;
    assert.equal(readFileSync(join(cwd, 'leaf.txt'), 'utf8'), signal);
    assert.throws(() => readFileSync(join(cwd, 'later.txt')), { code: 'ENOENT' });
  });
}
