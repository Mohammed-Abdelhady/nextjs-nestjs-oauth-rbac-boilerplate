import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { copyFile, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ARTIFACT_DIRS = new Set([
  '.git',
  '.hyperflow',
  '.claude',
  '.codex',
  '.agents',
  '.kilocode',
  'openspec',
  'node_modules',
  'dist',
  'build',
  '.next',
  'out',
  'coverage',
  '.turbo',
  'output',
  'test-results',
  'playwright-report',
  'blob-report',
  '.auth',
  '.mongodb-binaries',
  'mongodb-memory-server',
]);
const EXAMPLES = new Set(['.env.docker.example', 'backend/.env.example', 'frontend/.env.example']);
const IMAGE_TAGS = {
  backend: 'authboiler-smoke-backend:local',
  frontend: 'authboiler-smoke-frontend:local',
  nginx: 'authboiler-smoke-nginx:local',
};
const MAX_OUTPUT = 1024 * 1024;

export function prohibitedPath(path) {
  return (
    path
      .split('/')
      .some(
        (name) =>
          /^\.env(?:\.|$)/.test(name) ||
          /\.(pem|key|crt)$/i.test(name) ||
          ['.ssh', '.aws', '.kube', 'ssl'].includes(name),
      ) || /(^|\/)\.config\/gcloud(\/|$)/.test(path)
  );
}

export function excludedPath(path) {
  return (
    prohibitedPath(path) ||
    path.split('/').some((name) => ARTIFACT_DIRS.has(name)) ||
    /\.(log|tgz|tsbuildinfo)$/.test(path) ||
    path === 'packages/create-nest-next-auth/template' ||
    path.startsWith('packages/create-nest-next-auth/template/')
  );
}

// Filter names before opening content. Symlinks never enter the export.
export async function exportSource(source, target, prefix = '') {
  for (const entry of await readdir(join(source, prefix), { withFileTypes: true })) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (excludedPath(path)) continue;
    if (entry.isDirectory()) {
      await mkdir(join(target, path), { recursive: true });
      await exportSource(source, target, path);
    } else if (entry.isFile()) {
      await copyFile(join(source, path), join(target, path));
    }
  }
}

function cleanEnvironment(home, dockerHost) {
  const environment = { PATH: process.env.PATH, HOME: home, LANG: 'C.UTF-8', CI: 'true' };
  if (dockerHost) environment.DOCKER_HOST = dockerHost;
  return environment;
}

export function command(executable, args, { cwd, env, timeout = 30_000, signal } = {}) {
  return new Promise((resolveCommand, reject) => {
    const child = spawn(executable, args, {
      cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
    });
    let stdout = '';
    let bytes = 0;
    let failure;
    let killTimer;
    function kill(processSignal) {
      try {
        if (process.platform === 'win32') child.kill(processSignal);
        else process.kill(-child.pid, processSignal);
      } catch (error) {
        if (error.code !== 'ESRCH') failure ??= error;
      }
    }
    function stop(reason) {
      if (failure) return;
      failure = new Error(reason);
      kill('SIGTERM');
      killTimer = setTimeout(() => kill('SIGKILL'), 2000);
    }
    const timer = setTimeout(() => stop('command timed out'), timeout);
    const abort = () => stop('cancelled');
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    child.stdout.on('data', (chunk) => {
      bytes += chunk.length;
      if (bytes > MAX_OUTPUT) stop('command output limit exceeded');
      else stdout += chunk.toString();
    });
    // Runtime logs can contain configuration. Drain stderr without retaining it.
    child.stderr.resume();
    child.on('error', (error) => {
      failure = new Error(`cannot start ${executable}: ${error.code}`);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      clearTimeout(killTimer);
      signal?.removeEventListener('abort', abort);
      if (failure) reject(failure);
      else if (code !== 0) reject(new Error(`${executable} ${args[0]} exited ${code}`));
      else resolveCommand(stdout.trim());
    });
  });
}

export function smokeModel(original, fixtureDirectory) {
  const services = {};
  for (const name of ['mongodb', 'backend', 'frontend', 'nginx']) {
    const originalService = original.services?.[name];
    assert(originalService?.healthcheck, `missing ${name} healthcheck`);
    services[name] = {
      image: name === 'mongodb' ? originalService.image : IMAGE_TAGS[name],
      restart: 'no',
      networks: ['smoke'],
      healthcheck: originalService.healthcheck,
      ...(originalService.depends_on ? { depends_on: originalService.depends_on } : {}),
      ...(originalService.deploy ? { deploy: originalService.deploy } : {}),
    };
  }
  services.mongodb.environment = { MONGO_INITDB_DATABASE: 'smoke' };
  services.mongodb.volumes = ['smoke-data:/data/db'];
  services.backend.environment = {
    NODE_ENV: 'production',
    PORT: '5000',
    MONGO_URI: 'mongodb://mongodb:27017/smoke',
    CLIENT_URL: 'http://127.0.0.1',
    API_URL: 'http://backend:5000',
    OAUTH_STATE_SECRET: 'synthetic-docker-smoke-state-000000000000',
    AUTH_PASSWORD_ENABLED: 'true',
    MAGIC_LINK_ENABLED: 'false',
    TWO_FACTOR_ENABLED: 'false',
    PASSKEYS_ENABLED: 'false',
    SWAGGER_ENABLED: 'false',
  };
  const frontendPort = String(original.services.frontend.environment?.PORT);
  assert.equal(frontendPort, '3000', 'frontend PORT must match its listener and probe');
  services.frontend.environment = {
    NODE_ENV: 'production',
    HOSTNAME: '0.0.0.0',
    PORT: frontendPort,
  };
  for (const [name, port] of [
    ['backend', 5000],
    ['frontend', 3000],
    ['nginx', 8080],
  ]) {
    services[name].ports = [
      { target: port, published: '0', host_ip: '127.0.0.1', protocol: 'tcp' },
    ];
  }
  services.nginx.volumes = [
    {
      type: 'bind',
      source: join(fixtureDirectory, 'nginx-http.conf'),
      target: '/etc/nginx/nginx.conf',
      read_only: true,
    },
  ];
  return { services, volumes: { 'smoke-data': {} }, networks: { smoke: { internal: true } } };
}

export function httpFixture(config) {
  const route = config.match(/location = \/health\s*\{[^{}]*'\{"status":"healthy"\}'[^{}]*\}/)?.[0];
  assert(route, 'exact HTTP health route not found');
  return `pid /tmp/nginx.pid;\nevents {}\nhttp { server { listen 8080; listen [::]:8080;\n${route}\nlocation / { return 301 https://$host$request_uri; }\n} }\n`;
}

async function request(origin, path, signal) {
  const response = await fetch(`${origin}${path}`, {
    redirect: 'manual',
    signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
  });
  assert.equal(response.status, 200, `${path} status`);
  assert.equal(response.headers.get('location'), null, `${path} redirected`);
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    assert(size <= MAX_OUTPUT, `${path} response too large`);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function verifyCheckout() {
  const files = await command('git', ['ls-files', '-z'], {
    cwd: ROOT,
    env: cleanEnvironment(tmpdir()),
  });
  const blocked = files.split('\0').filter((path) => prohibitedPath(path) && !EXAMPLES.has(path));
  assert.equal(blocked.length, 0, 'BLOCKED: prohibited tracked paths; checkout was not read');
  console.log('checkout filename guard passed');
}

async function smoke(dockerHost) {
  const fixture = await mkdtemp(join(tmpdir(), 'authboiler-smoke-'));
  const project = `authsmoke-${randomUUID().replaceAll('-', '')}`;
  const controller = new AbortController();
  let composeReady = false;
  let cleanupFailed = false;
  let phase = 'export';
  const onSignal = (signal) => {
    process.exitCode = signal === 'SIGINT' ? 130 : 143;
    controller.abort();
  };
  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);
  const source = join(fixture, 'source');
  const dockerConfig = join(fixture, 'docker-config');
  const env = cleanEnvironment(fixture, dockerHost);
  const docker = (args, options = {}) =>
    command('docker', ['--config', dockerConfig, ...args], {
      cwd: fixture,
      env,
      signal: controller.signal,
      ...options,
    });
  const composeArgs = [
    'compose',
    '--project-name',
    project,
    '--project-directory',
    fixture,
    '--env-file',
    join(fixture, 'synthetic.env'),
    '-f',
    join(fixture, 'compose.json'),
  ];
  const compose = (args, options) => docker([...composeArgs, ...args], options);
  try {
    await mkdir(source);
    await mkdir(dockerConfig);
    await exportSource(ROOT, source);
    await writeFile(
      join(fixture, 'synthetic.env'),
      'MONGO_USERNAME=smoke\nMONGO_PASSWORD=synthetic-smoke\nMONGO_DATABASE=smoke\n',
    );
    phase = 'derive';
    const original = JSON.parse(
      await docker([
        'compose',
        '--project-name',
        project,
        '--project-directory',
        source,
        '--env-file',
        join(fixture, 'synthetic.env'),
        '-f',
        join(source, 'docker-compose.prod.yml'),
        'config',
        '--no-env-resolution',
        '--format',
        'json',
      ]),
    );
    await writeFile(
      join(fixture, 'nginx-http.conf'),
      httpFixture(await readFile(join(source, 'nginx/nginx.conf'), 'utf8')),
    );
    const model = smokeModel(original, fixture);
    await writeFile(join(fixture, 'compose.json'), JSON.stringify(model));
    composeReady = true;
    phase = 'local images';
    for (const service of Object.values(model.services))
      await docker(['image', 'inspect', service.image, '--format', '{{.Id}}']);
    phase = 'startup';
    const started = performance.now();
    await compose(
      ['up', '--detach', '--wait', '--wait-timeout', '240', '--no-build', '--pull', 'never'],
      { timeout: 260_000 },
    );
    console.log(`startup completed in ${((performance.now() - started) / 1000).toFixed(1)}s`);
    phase = 'assertions';
    const origins = {};
    for (const [name, port] of [
      ['backend', 5000],
      ['frontend', 3000],
      ['nginx', 8080],
    ]) {
      const address = await compose(['port', name, String(port)]);
      assert(/^127\.0\.0\.1:\d+$/.test(address), `${name} must bind loopback`);
      origins[name] = `http://${address}`;
    }
    const health = JSON.parse(await request(origins.backend, '/health', controller.signal));
    assert.deepEqual(Object.keys(health).sort(), ['status', 'timestamp']);
    assert.equal(health.status, 'healthy');
    assert(Number.isFinite(Date.parse(health.timestamp)), 'health timestamp');
    assert.deepEqual(JSON.parse(await request(origins.nginx, '/health', controller.signal)), {
      status: 'healthy',
    });
    for (const locale of ['en', 'ar']) {
      const html = await request(origins.frontend, `/${locale}/auth/login`, controller.signal);
      assert(html.includes(`lang="${locale}"`), `${locale} login document language`);
      assert(html.includes('<form'), `${locale} login form`);
    }
    const methods = JSON.parse(
      await request(origins.backend, '/api/auth/methods', controller.signal),
    ).data?.methods;
    assert(methods && typeof methods.password === 'boolean', 'auth method response');
    for (const name of ['magicLink', 'twoFactor', 'passkeys'])
      assert(!methods[name], `${name} disabled`);
    assert(
      !methods.oauth || (Array.isArray(methods.oauth) && methods.oauth.length === 0),
      'external providers disabled',
    );
    console.log('synthetic app and HTTP nginx checks passed; production TLS/certbot unverified');
  } catch (error) {
    process.exitCode ||= 1;
    console.error(`Docker smoke failed during ${phase}: ${error.message}`);
    if (composeReady) {
      try {
        const state = await compose(['ps', '--all', '--format', 'json'], {
          signal: undefined,
          timeout: 10_000,
        });
        const rows = state.startsWith('[')
          ? JSON.parse(state)
          : state
              .split('\n')
              .filter(Boolean)
              .map((line) => JSON.parse(line));
        console.error(
          JSON.stringify(
            rows.map(({ Service, State, Health, ExitCode }) => ({
              Service,
              State,
              Health,
              ExitCode,
            })),
          ),
        );
        const frontend = await compose(['ps', '--quiet', 'frontend'], {
          signal: undefined,
          timeout: 10_000,
        });
        if (/^[a-f0-9]{12,64}$/.test(frontend)) {
          const health = await docker(
            [
              'inspect',
              '--format',
              '{{.State.Health.Status}} {{.State.Health.FailingStreak}}{{range .State.Health.Log}} {{.ExitCode}}{{end}}',
              frontend,
            ],
            { signal: undefined, timeout: 10_000 },
          );
          if (/^(healthy|unhealthy|starting)( \d+)+$/.test(health))
            console.error(`frontend health status, failing streak, probe exit codes: ${health}`);
          const listeners = await compose(
            [
              'exec',
              '--no-TTY',
              'frontend',
              'node',
              '--input-type=module',
              '-e',
              `
            for (const host of ['127.0.0.1', '[::1]']) {
              try {
                const response = await fetch('http://' + host + ':3000/en/auth/login', { redirect: 'manual', signal: AbortSignal.timeout(5000) });
                console.log(JSON.stringify({ host, status: response.status }));
              } catch (error) {
                const code = error.cause?.code;
                console.log(JSON.stringify({ host, reason: ['ECONNREFUSED', 'ETIMEDOUT', 'ENETUNREACH'].includes(code) ? code : 'REQUEST_FAILED' }));
              }
            }
          `,
            ],
            { signal: undefined, timeout: 15_000 },
          );
          console.error(listeners);
        }
      } catch {
        console.error('container status unavailable');
      }
    }
  } finally {
    if (composeReady) {
      try {
        await compose(['down', '--volumes', '--remove-orphans', '--timeout', '10'], {
          signal: undefined,
          timeout: 40_000,
        });
        for (const [resource, args] of [
          ['container', ['ls', '--all', '--quiet']],
          ['network', ['ls', '--quiet']],
          ['volume', ['ls', '--quiet']],
        ]) {
          const remaining = await docker(
            [resource, ...args, '--filter', `label=com.docker.compose.project=${project}`],
            { signal: undefined, timeout: 10_000 },
          );
          assert.equal(remaining, '', `owned ${resource} remains`);
        }
      } catch {
        cleanupFailed = true;
        process.exitCode ||= 1;
        console.error(`cleanup incomplete for ${project}; retained recovery files at ${fixture}`);
      }
    }
    if (!cleanupFailed) {
      await rm(fixture, { recursive: true, force: true });
      console.log(`removed owned fixture ${project}`);
    }
    process.off('SIGINT', onSignal);
    process.off('SIGTERM', onSignal);
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--check-checkout') return verifyCheckout();
  if (args.length === 2 && args[0] === '--export') {
    const requested = resolve(args[1]);
    const target = join(realpathSync(dirname(requested)), basename(requested));
    assert(
      target !== ROOT && !target.startsWith(`${ROOT}/`),
      'export must be outside the source tree',
    );
    await mkdir(target); // Refuse an existing destination instead of merging unknown files.
    await exportSource(ROOT, target);
    console.log(`exported permitted source to ${target}`);
    return;
  }
  assert(
    args.length === 0 ||
      (args.length === 2 && args[0] === '--docker-host' && /^unix:\/\/\//.test(args[1])),
    'usage: node scripts/verify-docker.mjs [--check-checkout | --export NEW_DIRECTORY | --docker-host unix:///local/socket]',
  );
  await smoke(args[1]);
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode ||= 1;
  });
}
