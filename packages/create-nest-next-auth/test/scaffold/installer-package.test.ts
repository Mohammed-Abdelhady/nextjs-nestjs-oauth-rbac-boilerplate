import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { setProjectName } from '../../src/scaffold/package-json.js';

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

it('removes browser dependencies and retains runnable frontend dependencies', async () => {
  const root = await mkdtemp(join(tmpdir(), 'cna-package-'));
  roots.push(root);
  await mkdir(join(root, 'frontend'));
  await writeFile(join(root, 'package.json'), '{"name":"template"}');
  await writeFile(
    join(root, 'frontend/package.json'),
    JSON.stringify({
      scripts: { test: 'vitest run', 'test:e2e': 'playwright test' },
      devDependencies: {
        '@playwright/test': '^1.0.0',
        playwright: '^1.0.0',
        '@axe-core/playwright': '^4.0.0',
        vitest: '^5.0.0',
        typescript: '^5.0.0',
      },
    }),
  );
  await setProjectName(root, 'my-app');
  expect(JSON.parse(await readFile(join(root, 'frontend/package.json'), 'utf8'))).toEqual({
    scripts: { test: 'vitest run' },
    devDependencies: { vitest: '^5.0.0', typescript: '^5.0.0' },
  });
});

it('accepts a frontend without optional dependency or script groups', async () => {
  const root = await mkdtemp(join(tmpdir(), 'cna-package-'));
  roots.push(root);
  await mkdir(join(root, 'frontend'));
  await writeFile(join(root, 'package.json'), '{"name":"template"}');
  await writeFile(join(root, 'frontend/package.json'), '{"name":"frontend"}');

  await setProjectName(root, 'my-app');

  expect(JSON.parse(await readFile(join(root, 'frontend/package.json'), 'utf8'))).toEqual({
    name: 'frontend',
  });
});

it('removes the PostgreSQL prototype tooling from the backend and keeps the rest in order', async () => {
  const root = await mkdtemp(join(tmpdir(), 'cna-package-'));
  roots.push(root);
  await mkdir(join(root, 'frontend'));
  await mkdir(join(root, 'backend'));
  await writeFile(join(root, 'package.json'), '{"name":"template"}');
  await writeFile(join(root, 'frontend/package.json'), '{"name":"frontend"}');
  await writeFile(
    join(root, 'backend/package.json'),
    JSON.stringify({
      name: 'backend',
      dependencies: { mongoose: '^8.0.0' },
      devDependencies: {
        '@types/node': '^22.0.0',
        '@types/pg': '8.23.1',
        'embedded-postgres': '18.4.0-beta.17',
        jest: '^30.0.0',
        kysely: '0.28.17',
        'mongodb-memory-server': '^11.0.0',
        pg: '8.23.1',
      },
    }),
  );

  await setProjectName(root, 'my-app');

  expect(JSON.parse(await readFile(join(root, 'backend/package.json'), 'utf8'))).toEqual({
    name: 'backend',
    dependencies: { mongoose: '^8.0.0' },
    devDependencies: {
      '@types/node': '^22.0.0',
      jest: '^30.0.0',
      'mongodb-memory-server': '^11.0.0',
    },
  });
});

it('leaves a backend manifest without the prototype tooling byte-identical', async () => {
  const root = await mkdtemp(join(tmpdir(), 'cna-package-'));
  roots.push(root);
  await mkdir(join(root, 'frontend'));
  await mkdir(join(root, 'backend'));
  await writeFile(join(root, 'package.json'), '{"name":"template"}');
  await writeFile(join(root, 'frontend/package.json'), '{"name":"frontend"}');
  const backend = '{"name":"backend","devDependencies":{"jest":"^30.0.0"}}';
  await writeFile(join(root, 'backend/package.json'), backend);

  await setProjectName(root, 'my-app');

  expect(await readFile(join(root, 'backend/package.json'), 'utf8')).toBe(backend);
});

it('keeps a production dependency of the same name: only development tooling is removed', async () => {
  const root = await mkdtemp(join(tmpdir(), 'cna-package-'));
  roots.push(root);
  await mkdir(join(root, 'frontend'));
  await mkdir(join(root, 'backend'));
  await writeFile(join(root, 'package.json'), '{"name":"template"}');
  await writeFile(join(root, 'frontend/package.json'), '{"name":"frontend"}');
  await writeFile(
    join(root, 'backend/package.json'),
    JSON.stringify({ dependencies: { pg: '8.23.1' }, devDependencies: { kysely: '0.28.17' } }),
  );

  await setProjectName(root, 'my-app');

  expect(JSON.parse(await readFile(join(root, 'backend/package.json'), 'utf8'))).toEqual({
    dependencies: { pg: '8.23.1' },
    devDependencies: {},
  });
});
