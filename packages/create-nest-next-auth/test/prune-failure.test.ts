import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';

// The template copy is the only boundary mocked; the pruner and its marker
// error are the real ones.
vi.mock('../src/scaffold/copy.js', () => ({
  copyTemplate: async (_source: string, target: string) => {
    const { mkdir, writeFile } = await import('node:fs/promises');
    const { dirname, join: joinPath } = await import('node:path');
    const files: Record<string, string> = {
      'package.json': '{ "name": "app" }\n',
      'frontend/package.json': '{ "name": "frontend" }\n',
      'src/bad.ts': 'export const a = 1; // feature:not-a-real-id\n',
    };
    for (const [path, content] of Object.entries(files)) {
      const full = joinPath(target, path);
      await mkdir(dirname(full), { recursive: true });
      await writeFile(full, content, 'utf8');
    }
  },
}));

import { main } from '../src/cli.js';

const REPO_ROOT = fileURLToPath(new URL('../../..', import.meta.url));
const roots: string[] = [];

afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

describe('prune failure', () => {
  it('names the file and line, stops, prints no next steps and exits 1', async () => {
    const root = await mkdtemp(join(tmpdir(), 'cna-prune-failure-'));
    roots.push(root);
    const target = join(root, 'my-app');

    const stdout = vi.spyOn(process.stdout, 'write');
    const stderr = vi.spyOn(process.stderr, 'write');
    let code = 0;
    let output = '';
    try {
      code = await main([target, '--yes', '--no-install', '--no-git'], '0.0.0', REPO_ROOT);
      output = [...stdout.mock.calls, ...stderr.mock.calls].map((call) => String(call[0])).join('');
    } finally {
      stdout.mockRestore();
      stderr.mockRestore();
    }

    expect(code).toBe(1);
    expect(output).toContain('src/bad.ts:1');
    expect(output).toContain('not-a-real-id');
    expect(output).toContain('Pruning failed');
    expect(output).toContain(`Left the tree at ${target} so you can inspect it.`);
    expect(output).not.toContain('Next steps');
  });
});
