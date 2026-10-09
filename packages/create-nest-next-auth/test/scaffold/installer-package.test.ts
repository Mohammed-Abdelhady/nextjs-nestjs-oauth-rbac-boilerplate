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
