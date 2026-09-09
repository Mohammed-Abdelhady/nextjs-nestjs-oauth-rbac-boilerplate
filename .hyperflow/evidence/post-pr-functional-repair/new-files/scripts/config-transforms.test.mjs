import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  configureBackendPort,
  configureFrontendPort,
  configureNginxDomains,
} from './lib/config-transforms.js';
import { smokeModel } from './verify-docker.mjs';

const domains = {
  mainDomain: 'example.test',
  frontendDomain: 'www.example.test',
  backendDomain: 'api.example.test',
};
for (const file of ['nginx/nginx.conf', 'nginx/production-nginx.conf']) {
  test(`${file}: current and repeated domain setup`, async () => {
    const source = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
    const result = configureNginxDomains(source, domains);
    assert.match(result, /server_name example\.test www\.example\.test;/);
    assert.match(result, /server_name api\.example\.test;/);
    assert.equal((result.match(/listen 8443 ssl;/g) || []).length, 2);
    assert.equal((result.match(/listen \[::\]:8443 ssl;/g) || []).length, 2);
    assert.doesNotMatch(result, /listen (?:\[::\]:)?443\b|backend\/api\/health/);
    assert.match(result, /proxy_pass http:\/\/backend\/health;/);
    assert.equal(configureNginxDomains(result, domains), result);
    const changed = configureNginxDomains(result, {
      mainDomain: 'new.test',
      frontendDomain: 'new.test',
      backendDomain: 'api.new.test',
    });
    assert.equal((changed.match(/# API server/g) || []).length, 1);
    assert.match(changed, /server_name new\.test;/);
    assert.doesNotMatch(changed, /example\.test/);
  });
}
for (const file of ['docker-compose.yml', 'docker-compose.prod.yml']) {
  for (const port of [5001, 5507, 1, 65535]) {
    test(`${file}: backend port ${port} preserves frontend listener`, async () => {
      const source = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
      const result = configureBackendPort(source, port);
      const [backend, frontend] = result.split('  backend:\n')[1].split('  frontend:\n');
      assert.match(backend, new RegExp(`PORT: ${port}\\b`));
      assert.ok(backend.includes(`http://localhost:${port}/health`));
      assert.ok(backend.includes(file.includes('prod') ? `- '${port}'` : `- '${port}:${port}'`));
      assert.match(frontend, /PORT: 3000\b/);
      assert.equal(configureBackendPort(result, port), result);
      assert.ok(configureBackendPort(result, 6011).includes('http://localhost:6011/health'));
    });
  }
}
test('invalid ports and unknown config structure fail before writing', () => {
  for (const port of [0, -1, 65536, 1.5, 'invalid'])
    assert.throws(() => configureBackendPort('', port), /port/);
  assert.throws(() => configureBackendPort('', 5001), /service/);
  assert.throws(() => configureNginxDomains('', domains), /virtual host/);
});
test('smoke does not hide a missing or mismatched frontend PORT', () => {
  const model = {
    services: Object.fromEntries(
      ['mongodb', 'backend', 'frontend', 'nginx'].map((name) => [
        name,
        { healthcheck: { test: ['CMD', 'synthetic'] }, environment: {} },
      ]),
    ),
  };
  for (const port of [undefined, 5000]) {
    model.services.frontend.environment.PORT = port;
    assert.throws(() => smokeModel(model, '/synthetic'), /frontend PORT/);
  }
  model.services.frontend.environment.PORT = 3000;
  assert.equal(smokeModel(model, '/synthetic').services.frontend.environment.PORT, '3000');
});
test('manual startup commands exist in their workspaces', async () => {
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
  const manual = readme.split('### Start manually')[1].split('Endpoints:')[0];
  const commands = [...manual.matchAll(/npm run ([\w:-]+) -w ([\w-]+)/g)];
  assert.equal(commands.length, 2);
  for (const [, script, workspace] of commands) {
    const manifest = JSON.parse(
      await readFile(new URL(`../${workspace}/package.json`, import.meta.url), 'utf8'),
    );
    assert.equal(typeof manifest.scripts[script], 'string');
  }
});

test('architecture methods example satisfies the actual frontend response type', async () => {
  const require = createRequire(new URL('../frontend/package.json', import.meta.url));
  const ts = require('typescript');
  const document = await readFile(new URL('../docs/ARCHITECTURE.md', import.meta.url), 'utf8');
  const example = [...document.matchAll(/```json\n([\s\S]*?)```/g)].find((match) =>
    match[1].includes('"methods"'),
  )?.[1];
  const payload = example && JSON.parse(example);
  assert.ok(example, 'methods example exists');
  const filename = fileURLToPath(new URL('../methods-documentation-contract.ts', import.meta.url));
  const authTypes = fileURLToPath(
    new URL('../frontend/src/modules/auth/types/auth.types.js', import.meta.url),
  );
  const options = {
    noEmit: true,
    strict: true,
    skipLibCheck: true,
    types: [],
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
  };
  function errors(value) {
    const source = `import type { AuthMethodsResponse } from ${JSON.stringify(authTypes)}; const example = ${JSON.stringify(value)}; example.data satisfies AuthMethodsResponse;`;
    const host = ts.createCompilerHost(options);
    const getSourceFile = host.getSourceFile.bind(host);
    host.getSourceFile = (path, version, ...rest) =>
      path === filename
        ? ts.createSourceFile(path, source, version, true)
        : getSourceFile(path, version, ...rest);
    return ts.getPreEmitDiagnostics(ts.createProgram([filename], options, host));
  }
  assert.deepEqual(
    errors(payload).map((error) => ts.flattenDiagnosticMessageText(error.messageText, '\n')),
    [],
  );
  assert.ok(errors({ ...payload, data: { methods: { emailPassword: true } } }).length > 0);
});

for (const file of ['docker-compose.yml', 'docker-compose.prod.yml']) {
  for (const port of [3000, 5300]) {
    test(`${file}: frontend host port ${port} keeps internal port 3000`, async () => {
      const source = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
      const result = configureFrontendPort(configureBackendPort(source, 5507), port);
      const frontend = result.split('  frontend:\n')[1];
      if (file.includes('prod')) assert.match(frontend, /expose:\s*\n\s*- '3000'/);
      else assert.ok(frontend.includes(`- '${port}:3000'`));
      assert.match(frontend, /PORT: 3000\b/);
      assert.match(frontend, /http:\/\/127\.0\.0\.1:3000\/en\/auth\/login/);
      assert.equal(configureFrontendPort(result, port), result);
      assert.ok(result.includes('http://localhost:5507/health'));
    });
  }
}
