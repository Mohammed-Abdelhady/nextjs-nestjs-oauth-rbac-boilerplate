import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, writeFile, rm, stat, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { execFile, resolveOptionalDomain, writeFile as writeOwnedFile } from './lib/cli-utils.js';
import { createSetupSecrets, generateBackendEnv } from './lib/init-environment.js';

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

test('init writes OAuth and native DPoP secrets into backend configuration', async () => {
  const source = await readFile(new URL('./init.js', import.meta.url), 'utf8');
  const randomSizes = [];
  const secrets = createSetupSecrets((size) => {
    randomSizes.push(size);
    return Buffer.from(randomSizes.length === 1 ? 'A'.repeat(size) : 'B'.repeat(size));
  });
  const backendEnv = generateBackendEnv({
    appTitle: 'Test Application',
    env: { backendPort: 5001, frontendPort: 3000, mongoUri: 'mongodb://localhost/test' },
    smtp: { host: '', port: '587', secure: 'false', user: '', pass: '', from: '' },
    oauth: {
      google: { clientId: '', clientSecret: '' },
      facebook: { clientId: '', clientSecret: '' },
      github: { clientId: '', clientSecret: '' },
    },
    ...secrets,
  });

  assert.deepEqual(randomSizes, [48, 48]);
  assert.equal(
    secrets.stateSecret,
    'QUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFB',
  );
  assert.equal(
    secrets.nativeDpopNonceSecret,
    'QkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJC',
  );
  assert.notEqual(secrets.stateSecret, secrets.nativeDpopNonceSecret);
  assert.match(backendEnv, /OAUTH_CALLBACK_BASE_URL=http:\/\/localhost:5001\/api\/auth\/oauth/);
  assert.ok(
    backendEnv.includes(
      'OAUTH_STATE_SECRET=QUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFB',
    ),
  );
  assert.ok(
    backendEnv.includes(
      'AUTH_NATIVE_DPOP_NONCE_SECRET=QkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJC',
    ),
  );
  assert.match(backendEnv, /AUTH_NATIVE_ENABLED=false/);
  assert.match(source, /\.\.\.createSetupSecrets\(\)/);
  assert.match(source, /mode: 0o600/);
  assert.doesNotMatch(backendEnv, /frontendPort\}\/auth\/oauth\/callback/);
});
