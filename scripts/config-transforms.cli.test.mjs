import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, writeFile, rm, stat, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { execFile, resolveOptionalDomain, writeFile as writeOwnedFile } from './lib/cli-utils.js';

test('execFile does not interpret shell metacharacters in arguments', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'execfile-'));
  try {
    const pwned = join(directory, 'pwned');
    const result = execFile(process.execPath, ['-e', 'process.exit(0)', `; touch ${pwned}`], {
      silent: true,
      cwd: directory,
    });
    assert.equal(result.success, true, result.error);
    assert.equal(existsSync(pwned), false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('invalid optional domains fall back to the supplied default', () => {
  assert.equal(resolveOptionalDomain('www.example.test', 'www.fallback.test'), 'www.example.test');
  assert.equal(
    resolveOptionalDomain('not a domain; rm -rf', 'www.fallback.test'),
    'www.fallback.test',
  );
  assert.equal(resolveOptionalDomain('', 'www.fallback.test'), 'www.fallback.test');
});

test('owned env files are written mode 0600 even when they already exist', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'env-mode-'));
  try {
    const path = join(directory, '.env');
    writeOwnedFile(path, 'FIRST=1\n', { mode: 0o644 });
    writeOwnedFile(path, 'SECOND=2\n', { mode: 0o600 });
    assert.equal((await stat(path)).mode & 0o777, 0o600);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('init writes backend OAuth callbacks and a generated state secret', async () => {
  const source = await readFile(new URL('./init.js', import.meta.url), 'utf8');
  assert.match(
    source,
    /OAUTH_CALLBACK_BASE_URL=http:\/\/localhost:\$\{env\.backendPort\}\/api\/auth\/oauth/,
  );
  assert.match(source, /OAUTH_STATE_SECRET=\$\{config\.stateSecret\}/);
  assert.match(source, /randomBytes\(48\)\.toString\('base64url'\)/);
  assert.match(source, /mode: 0o600/);
  assert.doesNotMatch(source, /frontendPort\}\/auth\/oauth\/callback/);
});
