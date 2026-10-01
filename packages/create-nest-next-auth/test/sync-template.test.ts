import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const PACKAGE_DIR = fileURLToPath(new URL('..', import.meta.url));
const SCRIPT = join(PACKAGE_DIR, 'scripts/sync-template.mjs');

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

/** Runs the script against a fixture and returns the template directory it wrote. */
function buildTemplate(setup: (fixture: string) => void): string {
  const fixture = mkdtempSync(join(tmpdir(), 'cna-sync-'));
  roots.push(fixture);
  const script = join(fixture, 'packages/create-nest-next-auth/scripts/sync-template.mjs');
  mkdirSync(dirname(script), { recursive: true });
  copyFileSync(SCRIPT, script);
  writeFileSync(join(fixture, 'template.manifest.json'), '{"features":{}}');
  setup(fixture);
  execFileSync(process.execPath, [script], { timeout: 10_000, stdio: 'pipe' });
  return join(fixture, 'packages/create-nest-next-auth/template');
}

describe('sync-template exclusions', () => {
  it('leaves a .git pointer file out of the template', () => {
    const template = buildTemplate((fixture) => {
      writeFileSync(join(fixture, '.git'), 'gitdir: /elsewhere/worktrees/app\n');
      writeFileSync(join(fixture, 'kept.txt'), 'keep\n');
    });

    expect(existsSync(join(template, '.git'))).toBe(false);
    expect(existsSync(join(template, 'kept.txt'))).toBe(true);
  });

  it('leaves a .git directory out of the template', () => {
    const template = buildTemplate((fixture) => {
      mkdirSync(join(fixture, '.git', 'objects'), { recursive: true });
      writeFileSync(join(fixture, '.git', 'HEAD'), 'ref: refs/heads/main\n');
    });

    expect(existsSync(join(template, '.git'))).toBe(false);
  });
});
