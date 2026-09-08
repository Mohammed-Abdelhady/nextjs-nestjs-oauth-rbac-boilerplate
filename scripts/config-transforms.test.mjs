import { runFailureDiagnostics } from './lib/failure-diagnostics.mjs';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  runHttpProbes,
  httpProbeProgram,
  validateProbeResults,
} from './lib/docker-http-probes.mjs';
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
import { command, smokeModel } from './verify-docker.mjs';

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

function probeResponse(url) {
  if (url === 'http://backend:5000/health') {
    return new Response(JSON.stringify({ status: 'healthy', timestamp: '2026-09-08T00:00:00Z' }));
  }
  if (url === 'http://nginx:8080/health') return new Response('{"status":"healthy"}');
  if (url === 'http://frontend:3000/en/auth/login') return new Response('<html lang="en"><form>');
  if (url === 'http://frontend:3000/ar/auth/login') return new Response('<html lang="ar"><form>');
  if (url === 'http://backend:5000/api/auth/methods') {
    return new Response('{"data":{"methods":{"password":true,"oauth":[]}}}');
  }
  throw new Error('unexpected probe target');
}

test('internal smoke network has no incompatible host publications', () => {
  const original = {
    services: Object.fromEntries(
      ['mongodb', 'backend', 'frontend', 'nginx'].map((name) => [
        name,
        {
          healthcheck: { test: ['CMD', 'synthetic'] },
          environment: { PORT: '3000' },
        },
      ]),
    ),
  };
  const model = smokeModel(original, '/synthetic');
  assert.deepEqual(model.networks, { smoke: { internal: true } });
  for (const service of Object.values(model.services)) {
    assert.deepEqual(service.networks, ['smoke']);
    assert.equal(service.ports, undefined);
  }
});

test('fixed service DNS probes preserve all five HTTP contracts without exposing bodies', async () => {
  const urls = [];
  const result = await runHttpProbes(async (url, options) => {
    urls.push(url);
    assert.equal(options.redirect, 'manual');
    assert.ok(options.signal instanceof AbortSignal);
    return probeResponse(url);
  });
  assert.equal(urls.length, 5);
  validateProbeResults(JSON.stringify(result));
  assert.deepEqual(Object.keys(result), ['checked']);
  const output = await command(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `globalThis.fetch = ${probeResponse.toString()}; ${httpProbeProgram()}`,
    ],
    { env: {}, timeout: 5000 },
  );
  validateProbeResults(output);
});

for (const [name, response, reason] of [
  [
    'non200',
    () => new Response('private detail', { status: 503 }),
    'unexpected HTTP status or redirect',
  ],
  [
    'redirect',
    () => new Response('', { status: 302, headers: { location: '/other' } }),
    'unexpected HTTP status or redirect',
  ],
  [
    '200 redirect header',
    () => new Response('{}', { headers: { location: '/other' } }),
    'unexpected HTTP status or redirect',
  ],
  ['malformed JSON', () => new Response('private detail'), 'invalid JSON'],
  [
    'invalid health',
    () => new Response('{"status":"healthy","timestamp":"invalid"}'),
    'health response contract',
  ],
  ['null health', () => new Response('null'), 'health response contract'],
  ['oversize', () => new Response('x'.repeat(129)), 'response too large'],
]) {
  test(`HTTP probe rejects ${name} with bounded named diagnostics`, async () => {
    const result = await runHttpProbes(response, 1000, 128);
    assert.deepEqual(result, { failure: 'backend-health', reason });
    assert.throws(() => validateProbeResults(JSON.stringify(result)), /backend-health/);
    assert.ok(!JSON.stringify(result).includes('private detail'));
  });
}

for (const [name, suffix, body] of [
  ['nginx shape', ':8080/health', '{"status":"healthy","extra":true}'],
  ['English document', '/en/auth/login', '<html lang="ar"><form>'],
  ['Arabic form', '/ar/auth/login', '<html lang="ar">'],
  [
    'enabled external method',
    '/api/auth/methods',
    '{"data":{"methods":{"password":true,"magicLink":true}}}',
  ],
  ['missing password', '/api/auth/methods', '{"data":{"methods":{"oauth":[]}}}'],
  [
    'unexpected OAuth provider',
    '/api/auth/methods',
    '{"data":{"methods":{"password":true,"oauth":["external"]}}}',
  ],
]) {
  test(`HTTP probe rejects ${name} without dropping earlier checks`, async () => {
    const result = await runHttpProbes(async (url) =>
      url.endsWith(suffix) ? new Response(body) : probeResponse(url),
    );
    assert.ok(result.failure);
    assert.throws(() => validateProbeResults(JSON.stringify(result)), /contract/);
  });
}

test('request failures and timeouts retain only sanitized reasons', async () => {
  assert.deepEqual(
    await runHttpProbes(() => {
      throw new Error('private details');
    }),
    {
      failure: 'backend-health',
      reason: 'request failed',
    },
  );
  const keepAlive = setTimeout(() => {}, 1000);
  try {
    const result = await runHttpProbes(
      (_url, { signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(signal.reason), { once: true });
        }),
      20,
    );
    assert.deepEqual(result, { failure: 'backend-health', reason: 'request timed out' });
  } finally {
    clearTimeout(keepAlive);
  }
});

test('otherwise-valid HTTP200 with an empty Location header is rejected', async () => {
  const result = await runHttpProbes(async (url) => {
    const response = probeResponse(url);
    response.headers.set('location', '');
    return response;
  });
  assert.deepEqual(result, {
    failure: 'backend-health',
    reason: 'unexpected HTTP status or redirect',
  });
});

test('result parser rejects incomplete, malformed and unknown diagnostic payloads', () => {
  for (const output of [
    '',
    'null',
    '{}',
    '{"checked":[]}',
    '{"failure":"private","reason":"private"}',
  ]) {
    assert.throws(() => validateProbeResults(output), /result/);
  }
});

test('probe command preserves nonzero, timeout, cancellation and bounded output handling', async () => {
  const options = { env: {}, timeout: 1000 };
  await assert.rejects(command(process.execPath, ['-e', 'process.exit(3)'], options), /exited 3/);
  await assert.rejects(
    command(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
      ...options,
      timeout: 30,
    }),
    /timed out/,
  );
  await assert.rejects(
    command(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
      ...options,
      signal: AbortSignal.timeout(30),
    }),
    /cancelled/,
  );
  await assert.rejects(
    command(process.execPath, ['-e', 'process.stdout.write("x".repeat(1048577))'], options),
    /output limit/,
  );
});

const diagnosticOptions = {
  budgetMs: 150,
  captureLimitMs: 20,
  reserveMs: 50,
  minimumMs: 1,
  cleanupLimitMs: 10,
};

test('failure capture completes or skips without cancelling a healthy page', async () => {
  let captured = 0;
  let cancelled = 0;
  const callbacks = {
    capture: async () => {
      captured++;
    },
    cancel: async () => {
      cancelled++;
    },
  };
  assert.equal(await runFailureDiagnostics({ ...diagnosticOptions, ...callbacks }), 'completed');
  assert.equal(
    await runFailureDiagnostics({ ...diagnosticOptions, ...callbacks, budgetMs: 50 }),
    'skipped',
  );
  assert.equal(captured, 1);
  assert.equal(cancelled, 0);
});

for (const cleanup of ['completed', 'rejected', 'never-settles']) {
  test(`stalled capture is aborted with ${cleanup} cleanup and no later stage`, async () => {
    let continueCapture;
    let laterStage = false;
    let signal;
    let cancelled = false;
    const result = await runFailureDiagnostics({
      ...diagnosticOptions,
      capture: async (abortSignal) => {
        signal = abortSignal;
        await new Promise((resolve) => {
          continueCapture = resolve;
        });
        abortSignal.throwIfAborted();
        laterStage = true;
      },
      cancel: async () => {
        cancelled = true;
        if (cleanup === 'rejected') throw new Error('cleanup failed');
        if (cleanup === 'never-settles') await new Promise(() => {});
      },
    });
    assert.equal(result, 'timed-out');
    assert.equal(cancelled, true);
    assert.equal(signal.aborted, true);
    continueCapture();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(laterStage, false);
  });
}

test('rejected capture remains secondary to the identical original error', async () => {
  const original = new Error('original overflow assertion');
  const errors = [];
  try {
    throw original;
  } catch (error) {
    errors.push(error);
  }
  let cancelled = false;
  assert.equal(
    await runFailureDiagnostics({
      ...diagnosticOptions,
      capture: async () => {
        throw new Error('diagnostic failure');
      },
      cancel: async () => {
        cancelled = true;
        throw new Error('cleanup failure');
      },
    }),
    'failed',
  );
  assert.equal(cancelled, true);
  assert.equal(errors.length, 1);
  assert.equal(errors[0], original);
});

test('real Playwright afterEach preserves original failures when capture rejects or stalls', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'failure-capture-test-'));
  try {
    const require = createRequire(new URL('../frontend/package.json', import.meta.url));
    const playwright = require.resolve('@playwright/test');
    const helper = new URL('./lib/failure-diagnostics.mjs', import.meta.url).href;
    const config = join(directory, 'playwright.config.cjs');
    const report = join(directory, 'results.json');
    await writeFile(
      config,
      `module.exports = ${JSON.stringify({
        testDir: directory,
        testMatch: 'capture.spec.cjs',
        timeout: 1000,
        workers: 1,
        retries: 0,
        reporter: [['json', { outputFile: report }]],
      })};`,
    );
    await writeFile(
      join(directory, 'capture.spec.cjs'),
      `
      const { test, expect } = require(${JSON.stringify(playwright)});
      test.afterEach(async ({}, info) => {
        expect(info.error.message).toBe('Error: original overflow assertion');
        const { runFailureDiagnostics } = await import(${JSON.stringify(helper)});
        await runFailureDiagnostics({
          budgetMs: info.timeout, captureLimitMs: 20, reserveMs: 50, minimumMs: 1, cleanupLimitMs: 10,
          capture: async () => {
            if (info.title === 'rejected') throw new Error('capture rejected');
            if (info.title === 'stalled') await new Promise(() => {});
          },
          cancel: async () => { await new Promise(() => {}); },
        });
      });
      for (const name of ['completed', 'rejected', 'stalled']) {
        test(name, async () => { throw new Error('original overflow assertion'); });
      }
    `,
    );
    await assert.rejects(
      command(
        process.execPath,
        [
          join(dirname(require.resolve('playwright/package.json')), 'cli.js'),
          'test',
          '--config',
          config,
        ],
        {
          cwd: directory,
          env: { PATH: process.env.PATH },
          timeout: 15000,
        },
      ),
      /exited 1/,
    );
    const result = JSON.parse(await readFile(report, 'utf8'));
    const results = result.suites.flatMap((suite) =>
      suite.specs.flatMap((spec) => spec.tests.flatMap((item) => item.results)),
    );
    assert.equal(results.length, 3);
    for (const item of results) {
      assert.equal(item.status, 'failed');
      assert.equal(
        item.errors.length,
        1,
        JSON.stringify(item.errors.map((error) => error.message)),
      );
      assert.equal(item.errors[0].message.split('\n')[0], 'Error: original overflow assertion');
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
