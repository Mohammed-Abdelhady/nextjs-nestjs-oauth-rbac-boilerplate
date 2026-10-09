import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ARABIC_FORBIDDEN,
  DOCKER_FORBIDDEN,
  findForbiddenContent,
  LEGACY_PACKAGE_MANAGER_COMMANDS,
  PRODUCTION_FORBIDDEN,
} from '../support/reference-content.js';

const roots: string[] = [];

async function tree(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'cna-content-'));
  roots.push(root);
  for (const [path, content] of Object.entries(files)) {
    const target = join(root, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content, 'utf8');
  }
  return root;
}

afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

describe('findForbiddenContent', () => {
  it('finds a planted docker reference and ignores node_modules and lockfiles', async () => {
    const root = await tree({
      'note.md': 'Run docker compose up.\n',
      'node_modules/ignored.md': 'nginx\n',
      'pnpm-lock.yaml': 'docker-compose\n',
    });

    expect(findForbiddenContent(root, DOCKER_FORBIDDEN)).toEqual(['note.md']);
  });

  it('matches the production patterns case-insensitively', async () => {
    const root = await tree({ 'deploy.md': 'The Nginx edge and docker-compose.prod.\n' });

    expect(findForbiddenContent(root, PRODUCTION_FORBIDDEN)).toEqual(['deploy.md']);
  });

  it('finds each planted docker leftover', async () => {
    const root = await tree({
      'a.txt': 'pnpm run setup:prod\n',
      'b.txt': 'node scripts/verify-docker.mjs\n',
      'c.txt': 'See docs/operations/deployment.md.\n',
      'd.txt': 'The word nginx alone.\n',
    });

    expect(findForbiddenContent(root, DOCKER_FORBIDDEN).sort()).toEqual([
      'a.txt',
      'b.txt',
      'c.txt',
      'd.txt',
    ]);
  });

  it('finds each planted Arabic leftover', async () => {
    const root = await tree({
      'a.ts': "const locale = 'ar';\n",
      'b.md': 'This mentions Arabic.\n',
      'c.json': '{ "note": "messages/ar.json" }\n',
      'd.ts': "const header = 'ar;q=0';\n",
      'e.tsx': 'return switchToArabic(fallback);\n',
    });

    expect(findForbiddenContent(root, ARABIC_FORBIDDEN).sort()).toEqual([
      'a.ts',
      'b.md',
      'c.json',
      'd.ts',
      'e.tsx',
    ]);
  });

  it('returns nothing for a clean tree', async () => {
    const root = await tree({ 'README.md': '# Project\n' });

    expect(findForbiddenContent(root, DOCKER_FORBIDDEN)).toEqual([]);
  });

  it('finds npm, yarn, and bun commands in generated instruction text', async () => {
    const oldNpm = 'n' + 'pm';
    const oldYarn = 'y' + 'arn';
    const oldBun = 'b' + 'un';
    const root = await tree({
      'npm.md': `${oldNpm} run lint\n`,
      'yarn.md': `${oldYarn} install\n`,
      'bun.md': `${oldBun} run lint\n`,
    });

    expect(findForbiddenContent(root, LEGACY_PACKAGE_MANAGER_COMMANDS)).toEqual([
      'bun.md',
      'npm.md',
      'yarn.md',
    ]);
  });
});
