import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';

it('documents every capped directory family', async () => {
  const root = new URL('../../../../', import.meta.url);
  const guide = await readFile(new URL('docs/reference/code-quality.md', root), 'utf8');
  const policy = await readFile(new URL('scripts/guardrails/policy.mjs', root), 'utf8');
  const pattern = policy.match(/export const CAPPED_PATH =\s*\/(.+)\//)?.[1];
  expect(pattern).toBeDefined();
  const capped = new RegExp(pattern ?? '');
  const section = guide.slice(guide.indexOf('Human-maintained files'));
  expect(section).toContain('350 lines');
  for (const directory of [
    'backend/src',
    'backend/test',
    'backend/scripts',
    'backend/migrations',
    'frontend/src',
    'frontend/e2e',
    'packages/*/src',
    'packages/*/test',
    'packages/*/scripts',
    'shared/*/src',
    'mobile/*/src',
    'mobile/*/app',
    'mobile/*/test',
    'mobile/*/conformance',
    'scripts',
  ]) {
    expect(section, directory).toContain('`' + directory + '/**`');
    expect(capped.test(directory.replace('*', 'fixture') + '/probe.ts'), directory).toBe(true);
  }
  for (const path of ['docs/guide.ts', 'shared/core/test/probe.ts', 'frontend/scripts/probe.ts']) {
    expect(capped.test(path), path).toBe(false);
  }
});
