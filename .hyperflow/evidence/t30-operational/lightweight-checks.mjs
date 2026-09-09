import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import { promises as fsp } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const require = createRequire(path.join(root, 'package.json'));
const ts = require('typescript');
const yaml = require('yaml');
const helper = await import(path.join(root, 'scripts/verify-docker.mjs'));
const { checkFilteredContext } =
  await import('../t30-operational-repair/filtered-context-check.mjs');
const { checkHttpProbes } = await import('../t30-operational-repair/http-probe-checks.mjs');
const results = [];
checkFilteredContext();
pass(
  'filtered frontend context: before TS2307 reproduced; after config diagnostics and source imports clear',
);
function pass(name) {
  results.push({ name, status: 'PASS' });
  console.log(`PASS ${name}`);
}

const workflow = yaml.parse(fs.readFileSync(path.join(root, '.github/workflows/ci.yml'), 'utf8'));
const jobs = workflow.jobs;
assert(jobs['scaffold-combinations'].if.includes('github.repository'));
assert(jobs['backend-e2e'].if.includes('github.repository'));
const integration = jobs['backend-e2e'].steps;
assert(
  integration.findIndex((s) => s.name === 'Run anonymous browsers') <
    integration.findIndex((s) => s.name === 'Run authenticated browsers'),
);
assert.equal(
  jobs.docker.steps.filter(
    (s) =>
      s.uses === 'docker/build-push-action@v6' && s.with.load === true && s.with.push === false,
  ).length,
  3,
);
for (const job of Object.values(jobs)) {
  const guard = job.steps.findIndex((s) => s.name === 'Reject prohibited tracked filenames');
  assert(guard > 0);
  for (const [index, step] of job.steps.entries()) {
    if (step.run?.includes('npm ')) {
      assert(index > guard);
      assert(step.run.startsWith('env -i '));
    }
  }
}
pass('workflow parses; guarded clean commands, sequential browser suites, three local images');

for (const file of ['.dockerignore', 'nginx/.dockerignore']) {
  const lines = fs.readFileSync(path.join(root, file), 'utf8').split('\n');
  for (const rule of [
    '**/.env*',
    '**/*.pem',
    '**/*.key',
    '**/*.crt',
    '**/output',
    '**/test-results',
    '**/playwright-report',
    '**/.auth',
  ])
    assert(lines.includes(rule), `${file}: ${rule}`);
}
const nginx = fs.readFileSync(path.join(root, 'nginx/nginx.conf'), 'utf8');
const http = helper.httpFixture(nginx);
assert(http.includes('location = /health'));
assert(http.includes('return 200'));
assert(!http.includes('ssl_certificate'));
assert.throws(() => helper.httpFixture('events {} http {}'));
pass('Docker contexts exclude blocked/artifact names; HTTP route fixture excludes TLS');

const blockedNames = [
  '.env',
  '.env.local',
  'nested/.env.extra.example',
  'a.pem',
  'a.KEY',
  'a.crt',
  '.ssh/identity',
  '.aws/config',
  'nested/.config/gcloud/auth',
  '.kube/config',
  'nginx/ssl/anything',
];
for (const name of blockedNames) assert(helper.prohibitedPath(name), name);
for (const name of [
  'output/trace.zip',
  'frontend/.auth/state.json',
  'backend/test-results/result.json',
  '.mongodb-binaries/server',
])
  assert(helper.excludedPath(name), name);
for (const name of [
  'frontend/e2e/fixtures/auth.ts',
  'backend/test/utils/e2e-app.ts',
  'nginx/nginx.conf',
])
  assert(!helper.excludedPath(name), name);
pass('source-export filename classification');

const temp = await fsp.mkdtemp(path.join(tmpdir(), 't30-light-'));
try {
  const source = path.join(temp, 'source');
  const target = path.join(temp, 'target');
  await fsp.mkdir(path.join(source, 'output'), { recursive: true });
  await fsp.mkdir(target);
  await fsp.writeFile(path.join(source, 'output/sentinel.txt'), 'synthetic output');
  await fsp.writeFile(path.join(source, 'kept.txt'), 'kept');
  await fsp.symlink(path.join(source, 'kept.txt'), path.join(source, 'link.txt'));
  await helper.exportSource(source, target);
  assert.deepEqual(await fsp.readdir(target), ['kept.txt']);
  pass('source export prunes artifacts and skips symlinks');

  const packageDir = path.join(root, 'packages/create-nest-next-auth');
  const spec = fs.readFileSync(path.join(packageDir, 'test/e2e.test.ts'), 'utf8');
  const tree = ts.createSourceFile('e2e.test.ts', spec, ts.ScriptTarget.Latest, true);
  let callback;
  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      node.arguments[0]?.text ===
        'excludes runtime artifacts and prohibited names before copying template files'
    )
      callback = node.arguments[1].getText(tree);
    ts.forEachChild(node, visit);
  }
  visit(tree);
  assert(callback);
  const js = ts.transpileModule(`(${callback})();`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const scope = {
    ...fs,
    ...path,
    tmpdir,
    execFileSync,
    PACKAGE_DIR: packageDir,
    expect: (actual, message) => ({
      toBe: (expected) => assert.equal(actual, expected, message),
      toEqual: (expected) => assert.deepEqual(actual, expected, message),
    }),
  };
  delete scope.default;
  new Function(...Object.keys(scope), js)(...Object.values(scope));
  pass(
    'actual new CLI regression callback passes with disposable sentinel repo; package build deferred',
  );

  const original = {
    services: Object.fromEntries(
      ['mongodb', 'backend', 'frontend', 'nginx'].map((name) => [
        name,
        {
          image: name === 'mongodb' ? 'mongo:7' : undefined,
          healthcheck: { test: ['CMD', 'true'] },
          environment: { SHOULD_NOT_INHERIT: 'synthetic-rejected' },
          volumes: ['unowned:/ignored'],
          container_name: 'fixed',
          privileged: true,
        },
      ]),
    ),
  };
  const model = helper.smokeModel(original, temp);
  assert.equal(model.networks.smoke.internal, true);
  assert.equal(model.services.mongodb.ports, undefined);
  assert.deepEqual(Object.keys(model.services), ['mongodb', 'backend', 'frontend', 'nginx']);
  for (const service of Object.values(model.services)) {
    assert(!service.container_name && !service.privileged && !service.build && !service.env_file);
    assert(!service.environment?.SHOULD_NOT_INHERIT);
  }
  assert.throws(() => helper.smokeModel({ services: {} }, temp));
  pass(
    'derived model excludes inherited settings, certbot, mounts and fixed ports; requires healthchecks',
  );

  const timeoutStarted = Date.now();
  await assert.rejects(
    helper.command(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
      timeout: 100,
      env: { PATH: process.env.PATH },
    }),
    /timed out/,
  );
  assert(Date.now() - timeoutStarted < 5000);
  await assert.rejects(
    helper.command(process.execPath, ['-e', 'process.stdout.write("x".repeat(2 * 1024 * 1024))'], {
      env: { PATH: process.env.PATH },
    }),
    /output limit/,
  );
  await assert.rejects(
    helper.command('t30-no-such-executable', [], { env: { PATH: '/nonexistent' } }),
    /cannot start/,
  );
  pass('subprocess timeout, output bound and missing executable fail without hanging');

  const probeResults = await checkHttpProbes(temp, nginx, original, pass);
  for (const result of probeResults) {
    if (result.status === 'BLOCKED')
      results.push({
        name: `synthetic HTTP ${result.scenario.name}`,
        status: 'BLOCKED',
        reason: result.reason,
      });
  }

  for (const scenario of ['missing-image', 'startup-failure', 'cancel', 'cleanup-failure']) {
    const caseDir = path.join(temp, scenario);
    const repo = path.join(caseDir, 'repo');
    const bin = path.join(caseDir, 'bin');
    const calls = path.join(caseDir, 'calls.jsonl');
    await fsp.mkdir(path.join(repo, 'scripts'), { recursive: true });
    await fsp.mkdir(path.join(repo, 'nginx'));
    await fsp.mkdir(bin);
    await fsp.copyFile(
      path.join(root, 'scripts/verify-docker.mjs'),
      path.join(repo, 'scripts/verify-docker.mjs'),
    );
    await fsp.writeFile(path.join(repo, 'docker-compose.prod.yml'), 'services: {}');
    await fsp.writeFile(path.join(repo, 'nginx/nginx.conf'), nginx);
    const fake = `#!${process.execPath}\nconst fs = require('node:fs');\nconst args = process.argv.slice(2);\nfs.appendFileSync(${JSON.stringify(calls)}, JSON.stringify(args)+'\\n');\nif(args.includes('config')) console.log(${JSON.stringify(JSON.stringify(original))});\nelse if(args.includes('inspect')) { if(${JSON.stringify(scenario)} === 'missing-image') process.exit(1); console.log('synthetic-image'); }\nelse if(args.includes('up')) { if(${JSON.stringify(scenario)} === 'cancel') setInterval(()=>{},1000); else process.exit(1); }\nelse if(args.includes('ps')) console.log('[]');\nelse if(args.includes('down') && ${JSON.stringify(scenario)} === 'cleanup-failure') process.exit(1);\n`;
    await fsp.writeFile(path.join(bin, 'docker'), fake, { mode: 0o700 });
    const child = spawn(process.execPath, [path.join(repo, 'scripts/verify-docker.mjs')], {
      env: {
        PATH: `${bin}:${process.env.PATH}`,
        HOME: caseDir,
        TMPDIR: caseDir,
        OAUTH_FAKE_CLIENT_ID: 'must-not-inherit',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', (chunk) => {
      output += chunk;
    });
    child.stderr.on('data', (chunk) => {
      output += chunk;
    });
    const timer = setTimeout(() => child.kill('SIGKILL'), 15_000);
    let cancellation;
    if (scenario === 'cancel') {
      cancellation = setInterval(() => {
        if (fs.existsSync(calls) && fs.readFileSync(calls, 'utf8').includes('"up"'))
          child.kill('SIGTERM');
      }, 30);
    }
    const code = await new Promise((resolveExit, reject) => {
      child.on('error', reject);
      child.on('close', resolveExit);
    });
    clearTimeout(timer);
    clearInterval(cancellation);
    assert.equal(code, scenario === 'cancel' ? 143 : 1, `${scenario}: ${output}`);
    const history = fs
      .readFileSync(calls, 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    assert(
      history.some((args) => args.includes('down') && args.includes('--volumes')),
      scenario,
    );
    if (scenario === 'missing-image') assert(!history.some((args) => args.includes('up')));
    const retained = (await fsp.readdir(caseDir)).filter((name) =>
      name.startsWith('authboiler-smoke-'),
    );
    assert.equal(retained.length, scenario === 'cleanup-failure' ? 1 : 0, output);
    if (scenario === 'cleanup-failure') assert(output.includes('retained recovery files'));
    else assert(output.includes('removed owned fixture'));
    pass(`fake Docker ${scenario}: nonzero status and expected owned cleanup/recovery`);
  }
} finally {
  await fsp.rm(temp, { recursive: true, force: true });
  assert.equal(fs.existsSync(temp), false);
  console.log(`removed lightweight parent ${temp}`);
}
await fsp.writeFile(
  path.join(root, '.hyperflow/evidence/t30-operational-repair/lightweight-results.json'),
  JSON.stringify(
    {
      realDocker: false,
      noListen: process.argv.includes('--no-listen'),
      node: process.version,
      results,
      cleanup:
        'all lightweight fixtures removed; no listener started in --no-listen mode; no Docker daemon or browser started',
    },
    null,
    2,
  ),
);
