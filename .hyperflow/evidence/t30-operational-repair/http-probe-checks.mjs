import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import { promises as fsp } from 'node:fs';
import { createServer } from 'node:http';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const evidence = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(evidence, '../../..');
const scenarios = [
  { name: 'success' },
  { name: 'health-status', error: '/health status' },
  { name: 'health-redirect', error: '/health status' },
  { name: 'health-json', error: 'JSON' },
  { name: 'health-extra-field', error: 'deep-equal' },
  { name: 'health-oversize', error: 'response too large' },
  { name: 'frontend-language', error: 'ar login document language' },
  { name: 'enabled-provider', error: 'external providers disabled' },
  { name: 'http-sigint', signal: 'SIGINT', exit: 130 },
  { name: 'http-sigterm', signal: 'SIGTERM', exit: 143 },
  ...['container', 'network', 'volume'].map((resource) => ({
    name: `residual-${resource}`,
    resource,
  })),
  ...['container', 'network', 'volume'].map((resource) => ({
    name: `residual-malformed-${resource}`,
    resource,
    port: '',
  })),
  ...['', '0.0.0.0:1234', '127.0.0.1:abc', '127.0.0.1:65536', '127.0.0.1:1234\n127.0.0.1:5678'].map(
    (port, index) => ({ name: `malformed-port-${index}`, port }),
  ),
];

export async function checkHttpProbes(temp, nginx, original, pass) {
  const results = [];
  for (const scenario of scenarios) {
    if (process.argv.includes('--no-listen') && !Object.hasOwn(scenario, 'port')) {
      results.push({
        scenario,
        status: 'BLOCKED',
        reason: 'Prior loopback listen EPERM; no retry. See listen-denied.log.',
      });
      console.log(`BLOCKED synthetic HTTP ${scenario.name}: loopback listen denied`);
      continue;
    }
    const caseDir = path.join(temp, `http-${scenario.name}`);
    const repo = path.join(caseDir, 'repo');
    const bin = path.join(caseDir, 'bin');
    const calls = path.join(caseDir, 'calls.jsonl');
    const requests = [];
    const servers = [];
    const ports = { backend: 65536, frontend: 65536, nginx: 65536 };
    let child;
    let childClosed;
    let timer;
    try {
      await fsp.mkdir(path.join(repo, 'scripts'), { recursive: true });
      await fsp.mkdir(path.join(repo, 'nginx'));
      await fsp.mkdir(bin);
      await fsp.copyFile(
        path.join(root, 'scripts/verify-docker.mjs'),
        path.join(repo, 'scripts/verify-docker.mjs'),
      );
      await fsp.writeFile(path.join(repo, 'docker-compose.prod.yml'), 'services: {}');
      await fsp.writeFile(path.join(repo, 'nginx/nginx.conf'), nginx);
      for (const service of Object.hasOwn(scenario, 'port')
        ? []
        : ['backend', 'frontend', 'nginx']) {
        const server = createServer((request, response) => {
          requests.push(`${service} ${request.url}`);
          if (scenario.signal) {
            child.kill(scenario.signal);
            return;
          }
          if (service === 'backend' && request.url === '/health') {
            if (scenario.name === 'health-status') {
              response.writeHead(503).end('unavailable');
              return;
            }
            if (scenario.name === 'health-redirect') {
              response.writeHead(302, { location: '/elsewhere' }).end();
              return;
            }
            if (scenario.name === 'health-json') {
              response.end('{');
              return;
            }
            if (scenario.name === 'health-oversize') {
              response.end('x'.repeat(1024 * 1024 + 1));
              return;
            }
            const health = { status: 'healthy', timestamp: new Date().toISOString() };
            if (scenario.name === 'health-extra-field') health.extra = true;
            response.end(JSON.stringify(health));
            return;
          }
          if (service === 'nginx' && request.url === '/health') {
            response.end('{"status":"healthy"}');
            return;
          }
          if (service === 'frontend') {
            const locale =
              request.url.startsWith('/ar/') && scenario.name !== 'frontend-language' ? 'ar' : 'en';
            response.end(`<html lang="${locale}"><form></form></html>`);
            return;
          }
          response.end(
            JSON.stringify({
              data: {
                methods: {
                  password: true,
                  magicLink: false,
                  twoFactor: false,
                  passkeys: false,
                  oauth: scenario.name === 'enabled-provider' ? ['synthetic'] : [],
                },
              },
            }),
          );
        });
        servers.push(server);
        await new Promise((resolve, reject) => {
          server.once('error', reject);
          server.listen(0, '127.0.0.1', resolve);
        });
        ports[service] = server.address().port;
        assert(![3107, 5107, 5108].includes(ports[service]));
      }
      const fake = `#!${process.execPath}
const fs = require('node:fs');
const assert = require('node:assert/strict');
const args = process.argv.slice(2);
const scenario = ${JSON.stringify(scenario)};
const ports = ${JSON.stringify(ports)};
assert.equal(process.env.OAUTH_FAKE_CLIENT_ID, undefined);
fs.appendFileSync(${JSON.stringify(calls)}, JSON.stringify(args)+'\\n');
if (args.includes('config')) console.log(${JSON.stringify(JSON.stringify(original))});
else if (args.includes('inspect')) console.log('synthetic-image');
else if (args.includes('port')) {
  const service = args[args.indexOf('port') + 1];
  console.log(Object.hasOwn(scenario, 'port') && service === 'backend' ? scenario.port : '127.0.0.1:' + ports[service]);
} else if (args.includes('ps')) console.log('[]');
else if (scenario.resource && args.includes(scenario.resource) && args.includes('ls')) console.log('synthetic-residual-resource');
`;
      await fsp.writeFile(path.join(bin, 'docker'), fake, { mode: 0o700 });
      child = spawn(process.execPath, [path.join(repo, 'scripts/verify-docker.mjs')], {
        env: {
          PATH: bin,
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
      childClosed = new Promise((resolve, reject) => {
        child.once('error', reject);
        child.once('close', (code, signal) => resolve({ code, signal }));
      });
      timer = setTimeout(() => child.kill('SIGKILL'), 15_000);
      const { code, signal } = await childClosed;
      clearTimeout(timer);
      assert.equal(signal, null, output);
      assert.equal(code, scenario.exit ?? (scenario.name === 'success' ? 0 : 1), output);
      const history = fs
        .readFileSync(calls, 'utf8')
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line));
      assert.equal(history.filter((args) => args.includes('up')).length, 1);
      assert(
        history.some((args) => args.includes('port')),
        output,
      );
      const down = history.find((args) => args.includes('down'));
      assert(down?.includes('--volumes') && down.includes('--remove-orphans'), output);
      const project = down[down.indexOf('--project-name') + 1];
      const lists = history.filter((args) => args.includes('ls'));
      for (const args of lists)
        assert(args.includes(`label=com.docker.compose.project=${project}`));
      const retained = (await fsp.readdir(caseDir)).filter((name) =>
        name.startsWith('authboiler-smoke-'),
      );
      assert.equal(retained.length, scenario.resource ? 1 : 0, output);
      if (scenario.resource) {
        assert(output.includes('retained recovery files'), output);
        assert(fs.existsSync(path.join(caseDir, retained[0], 'compose.json')));
        assert.equal(
          lists.length,
          ['container', 'network', 'volume'].indexOf(scenario.resource) + 1,
        );
      } else {
        assert.equal(lists.length, 3);
        assert(output.includes('removed owned fixture'), output);
      }
      if (Object.hasOwn(scenario, 'port')) {
        assert.deepEqual(requests, []);
        assert(
          output.includes(
            scenario.port === '127.0.0.1:65536'
              ? 'Failed to parse URL'
              : 'backend must bind loopback',
          ),
          output,
        );
      } else assert.equal(requests[0], 'backend /health');
      if (
        scenario.name === 'success' ||
        (scenario.resource && !Object.hasOwn(scenario, 'port')) ||
        scenario.name === 'enabled-provider'
      ) {
        assert.deepEqual(requests, [
          'backend /health',
          'nginx /health',
          'frontend /en/auth/login',
          'frontend /ar/auth/login',
          'backend /api/auth/methods',
        ]);
      }
      if (scenario.error) assert(output.includes(scenario.error), output);
      if (scenario.signal) assert.equal(requests.length, 1);
      assert.throws(() => process.kill(child.pid, 0), { code: 'ESRCH' });
      results.push({
        scenario,
        code,
        signal,
        pid: child.pid,
        ports,
        requests,
        history,
        output,
        helperRetainedFixtures: retained,
        childAbsent: true,
      });
      pass(`fake helper ${scenario.name}: port discovery, expected exit and cleanup contract`);
    } finally {
      clearTimeout(timer);
      if (child && child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
      if (childClosed) await childClosed;
      for (const server of servers) {
        server.closeAllConnections();
        await new Promise((resolve) => server.close(resolve));
        assert.equal(server.listening, false);
      }
      await fsp.rm(caseDir, { recursive: true, force: true });
      assert.equal(fs.existsSync(caseDir), false);
    }
  }
  await fsp.writeFile(
    path.join(evidence, 'http-probe-results.json'),
    JSON.stringify(
      {
        realDocker: false,
        results,
        cleanup:
          'Executed child close events awaited and child PIDs absent; owned case directories removed. No listener started in --no-listen mode. Residual Docker resources were synthetic responses only.',
      },
      null,
      2,
    ),
  );
  return results;
}
