import assert from 'node:assert/strict';
import { cleanEnvironment, command } from './lib/docker-command.mjs';
import { httpProbeProgram, validateProbeResults } from './lib/docker-http-probes.mjs';
import { httpFixture, smokeModel } from './lib/docker-smoke-model.mjs';
import { EXAMPLES, exportSource, prohibitedPath } from './lib/docker-source-export.mjs';
import { randomUUID } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export { command } from './lib/docker-command.mjs';
export { httpFixture, smokeModel } from './lib/docker-smoke-model.mjs';
export { excludedPath, exportSource, prohibitedPath } from './lib/docker-source-export.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

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
  const docker = (args, options = {}) => {
    const { label = phase, ...rest } = options;
    return command('docker', ['--config', dockerConfig, ...args], {
      cwd: fixture,
      env,
      signal: controller.signal,
      label,
      ...rest,
    });
  };
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
    phase = 'container HTTP probes';
    const results = await compose(
      ['exec', '-T', 'backend', 'node', '--input-type=module', '-e', httpProbeProgram()],
      { timeout: 65_000 },
    );
    validateProbeResults(results);
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
