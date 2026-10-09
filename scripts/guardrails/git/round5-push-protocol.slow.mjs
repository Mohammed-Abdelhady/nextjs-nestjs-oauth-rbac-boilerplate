import assert from 'node:assert/strict';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { closeSync, existsSync, openSync, rmSync, writeSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { outcome, repository } from '../test-repository.mjs';

const TOKEN = 'inner' + 'HTML';
const CLEAN = 'export const value = 1;\n';
const ZERO = '0'.repeat(40);
const PASS = { status: 0, hits: [], caps: [] };
const record = (local, remote = ZERO, localRef = 'refs/heads/feature') =>
  `${localRef} ${local} refs/heads/feature ${remote}\n`;

for (const input of ['', '\n\r\n  \n']) {
  test(`explicit hook empty input is a no-op with dirty HEAD: ${JSON.stringify(input)}`, (t) => {
    const repo = repository(t);
    repo.write('src/root.ts', `node.${TOKEN} = value;\n`);
    repo.commit();
    const hook = repo.checkInput(input, '--push', '--hook', 'origin');
    const manual = repo.checkInput(input, '--push');
    assert.deepEqual(
      { ...outcome(hook), diagnostic: hook.diagnostic },
      { ...PASS, diagnostic: 'no ref updates on stdin, nothing to scan\n' },
    );
    assert.deepEqual(
      { ...outcome(manual), diagnostic: manual.diagnostic },
      { status: 0, hits: [], caps: [], diagnostic: '' },
    );
    repo.write('src/new.ts', `node.${TOKEN} = value;\n`);
    repo.commit();
    assert.deepEqual(outcome(repo.checkInput(input, '--push', '--hook', 'origin')), PASS);
    assert.deepEqual(outcome(repo.checkInput(input, '--push')), {
      status: 1,
      hits: [['src/new.ts', 1, TOKEN]],
      caps: [],
    });
  });
}

test('stdin right parsing accepts a local expression containing spaces and CRLF records', (t) => {
  const repo = repository(t);
  repo.write('src/root.ts', CLEAN);
  const remote = repo.commit();
  repo.write('src/new.ts', `node.${TOKEN} = value;\n`);
  const head = repo.commit();
  const input = record(head, remote, 'HEAD@{0 seconds ago}').replace('\n', '\r\n');
  assert.deepEqual(outcome(repo.checkInput(input, '--push', '--hook', 'origin')), {
    status: 1,
    hits: [['src/new.ts', 1, TOKEN]],
    caps: [],
  });
});

test('SHA-256 object records scan new violations and accept unchanged references', (t) => {
  const repo = repository(t, ['--object-format=sha256']);
  repo.write('src/root.ts', CLEAN);
  const old = repo.commit();
  repo.write('src/new.ts', `node.${TOKEN} = value;\n`);
  const head = repo.commit();
  assert.deepEqual(outcome(repo.checkInput(record(head, old), '--push', '--hook', 'origin')), {
    status: 1,
    hits: [['src/new.ts', 1, TOKEN]],
    caps: [],
  });
  assert.deepEqual(
    outcome(repo.checkInput(record(head, head), '--push', '--hook', 'origin')),
    PASS,
  );
  assert.deepEqual(
    outcome(repo.checkInput(record('0'.repeat(64), head), '--push', '--hook', 'origin')),
    PASS,
  );
});

test('a thousand streamed records include the final dirty ref instead of stopping at a pipe buffer', (t) => {
  const repo = repository(t);
  repo.write('src/root.ts', CLEAN);
  const old = repo.commit();
  repo.write('src/last.ts', `node.${TOKEN} = value;\n`);
  const head = repo.commit();
  const cleanRecords = Array.from(
    { length: 999 },
    (_, index) =>
      `refs/tags/clean-${index}-padding-padding-padding-padding ${old} refs/tags/clean-${index} ${old}\n`,
  ).join('');
  assert.deepEqual(
    outcome(repo.checkInput(cleanRecords + record(head, old), '--push', '--hook', 'origin')),
    {
      status: 1,
      hits: [['src/last.ts', 1, TOKEN]],
      caps: [],
    },
  );
});

test('a late writer sends hook records only after the checker process is ready', async (t) => {
  const repo = repository(t);
  repo.write('src/root.ts', CLEAN);
  const old = repo.commit();
  repo.write('src/late.ts', `node.${TOKEN} = value;\n`);
  const head = repo.commit();
  const cli = pathToFileURL(repo.entry.replace('check-hard-bans.mjs', 'guardrails/scanner/cli.mjs')).href;
  const child = spawn(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `import { main } from ${JSON.stringify(cli)};\n` +
        "process.send('ready'); process.exitCode = await main(['--push', '--hook', 'origin']);\n",
    ],
    { cwd: repo.root, env: repo.env, stdio: ['pipe', 'pipe', 'pipe', 'ipc'] },
  );
  let diagnostic = '';
  child.stderr.on('data', (chunk) => {
    diagnostic += chunk;
  });
  child.stdout.resume();
  child.on('message', (message) => {
    if (message === 'ready') child.stdin.end(record(head, old));
  });
  child.stdin.on('error', () => {});
  const status = await new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', resolve);
  });
  assert.deepEqual(
    { status, refused: diagnostic.includes(`src/late.ts:1: banned token "${TOKEN}"`) },
    { status: 1, refused: true },
  );
});

test(
  'a FIFO late writer preserves the inherited blocking descriptor at the read handoff',
  { timeout: 10_000 },
  async (t) => {
    if (!['darwin', 'linux'].includes(process.platform)) {
      t.skip('FIFO descriptor observation requires macOS lsof or Linux /proc fdinfo.');
      return;
    }
    if (
      (process.platform === 'darwin' &&
        spawnSync('which', ['lsof'], {
          cwd: process.cwd(),
          env: { PATH: process.env.PATH },
          stdio: 'pipe',
        }).status !== 0) ||
      (process.platform === 'linux' && !existsSync('/proc/self/fdinfo/0'))
    ) {
      t.skip('FIFO descriptor observation tool is unavailable: macOS lsof or Linux /proc fdinfo.');
      return;
    }
    const repo = repository(t);
    repo.write('src/root.ts', CLEAN);
    const old = repo.commit();
    repo.write('src/fifo.ts', `node.${TOKEN} = value;\n`);
    const head = repo.commit();
    const cli = pathToFileURL(repo.entry.replace('check-hard-bans.mjs', 'guardrails/scanner/cli.mjs')).href;
    repo.write(
      'fifo-reader.mjs',
      "import fs from 'node:fs';\nimport { execFileSync } from 'node:child_process';\n" +
        "import { syncBuiltinESMExports } from 'node:module';\n" +
        `import { main } from ${JSON.stringify(cli)};\n` +
        'const native = fs.readFileSync;\n' +
        'fs.readFileSync = (...args) => {\n' +
        '  if (args[0] === 0) {\n' +
        '    let flags;\n' +
        "    if (process.platform === 'darwin') {\n" +
        "      const output = execFileSync('lsof', ['-nP', '-a', '-p', String(process.pid), '-d0', '-F', 'G'],\n" +
        "        { cwd: process.cwd(), env: process.env, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });\n" +
        '      flags = Number.parseInt(output.match(/^G0x([a-f0-9]+)/m)[1], 16);\n' +
        '    } else {\n' +
        "      const output = native(`/proc/${process.pid}/fdinfo/0`, 'utf8');\n" +
        '      flags = Number.parseInt(output.match(/^flags:\\s*([0-7]+)/m)[1], 8);\n' +
        '    }\n' +
        '    process.send({ ready: true, nonblocking: Boolean(flags & fs.constants.O_NONBLOCK) });\n' +
        '  }\n  return native(...args);\n};\nsyncBuiltinESMExports();\n' +
        "process.exitCode = main(['--push', '--hook', 'origin']);\n",
    );
    execFileSync('mkfifo', ['stdin.fifo'], { cwd: repo.root, env: repo.env });
    const child = spawn('sh', ['-c', 'exec "$GUARDRAILS_NODE" fifo-reader.mjs < stdin.fifo'], {
      cwd: repo.root,
      env: { ...repo.env, GUARDRAILS_NODE: process.execPath, NODE_CHANNEL_FD: '3' },
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      detached: true,
    });
    let writer;
    let writerClosed = false;
    const cancel = () => {
      try {
        if (child.pid !== undefined && child.exitCode === null && child.signalCode === null) {
          try {
            process.kill(-child.pid, 'SIGKILL');
          } catch (error) {
            if (error.code !== 'ESRCH') throw error;
          }
        }
      } finally {
        if (writer !== undefined && !writerClosed) {
          closeSync(writer);
          writerClosed = true;
        }
        rmSync(repo.root, { recursive: true, force: true });
      }
    };
    t.signal.addEventListener('abort', cancel, { once: true });
    t.after(() => {
      t.signal.removeEventListener('abort', cancel);
      cancel();
    });
    let nonblocking;
    let diagnostic = '';
    child.stderr.on('data', (chunk) => {
      diagnostic += chunk;
    });
    child.stdout.resume();
    writer = openSync(join(repo.root, 'stdin.fifo'), 'r+');
    child.on('message', (message) => {
      if (!message.ready || writerClosed || t.signal.aborted) return;
      nonblocking = message.nonblocking;
      try {
        writeSync(writer, record(head, old));
      } catch (error) {
        if (error.code !== 'EPIPE') throw error;
      } finally {
        closeSync(writer);
        writerClosed = true;
      }
    });
    const status = await new Promise((resolve, reject) => {
      child.on('error', reject);
      child.on('close', resolve);
    });
    assert.deepEqual(
      {
        status,
        nonblocking,
        refused: diagnostic.includes(`src/fifo.ts:1: banned token "${TOKEN}"`),
      },
      { status: 1, nonblocking: false, refused: true },
    );
  },
);
