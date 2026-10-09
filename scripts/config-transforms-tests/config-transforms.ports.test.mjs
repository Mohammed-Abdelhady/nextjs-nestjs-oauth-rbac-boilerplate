import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import test from 'node:test';
import { configureBackendPort, configureFrontendPort } from '../lib/config-transforms.js';

// The port transforms belong to the docker option, so their tests run whenever
// docker is on. They only read the development compose, which is docker-owned;
// the production compose is checked by the production-owned suite.
const COMPOSE = 'docker-compose.yml';

for (const port of [5001, 5507, 1, 65535]) {
  test(`${COMPOSE}: backend port ${port} preserves frontend listener`, async () => {
    const source = await readFile(new URL(`../../${COMPOSE}`, import.meta.url), 'utf8');
    const result = configureBackendPort(source, port);
    const [backend, frontend] = result.split('  backend:\n')[1].split('  frontend:\n');
    assert.match(backend, new RegExp(`PORT: ${port}\\b`));
    assert.ok(backend.includes(`http://localhost:${port}/health`));
    assert.ok(backend.includes(`- '${port}:${port}'`));
    assert.match(frontend, /PORT: 3000\b/);
    assert.equal(configureBackendPort(result, port), result);
    assert.ok(configureBackendPort(result, 6011).includes('http://localhost:6011/health'));
  });
}

for (const port of [3000, 5300]) {
  test(`${COMPOSE}: frontend host port ${port} keeps internal port 3000`, async () => {
    const source = await readFile(new URL(`../../${COMPOSE}`, import.meta.url), 'utf8');
    const result = configureFrontendPort(configureBackendPort(source, 5507), port);
    const frontend = result.split('  frontend:\n')[1];
    assert.ok(frontend.includes(`- '${port}:3000'`));
    assert.match(frontend, /PORT: 3000\b/);
    assert.match(frontend, /http:\/\/127\.0\.0\.1:3000\/en\/auth\/login/);
    assert.equal(configureFrontendPort(result, port), result);
    assert.ok(result.includes('http://localhost:5507/health'));
  });
}

test('invalid ports and unknown config structure fail before writing', () => {
  for (const port of [0, -1, 65536, 1.5, 'invalid'])
    assert.throws(() => configureBackendPort('', port), /port/);
  assert.throws(() => configureBackendPort('', 5001), /service/);
});
