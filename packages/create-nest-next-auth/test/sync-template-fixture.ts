import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_DIR = fileURLToPath(new URL('..', import.meta.url));
const SCRIPT = join(PACKAGE_DIR, 'scripts/sync-template.mjs');

export function runScript(fixture: string): void {
  const script = join(fixture, 'packages/create-nest-next-auth/scripts/sync-template.mjs');
  execFileSync(process.execPath, [script], { timeout: 10_000, stdio: 'pipe' });
}

export function newFixture(roots: string[]): string {
  const fixture = mkdtempSync(join(tmpdir(), 'cna-sync-'));
  roots.push(fixture);
  const script = join(fixture, 'packages/create-nest-next-auth/scripts/sync-template.mjs');
  mkdirSync(dirname(script), { recursive: true });
  copyFileSync(SCRIPT, script);
  const constants = join(fixture, 'packages/create-nest-next-auth/src/constants');
  mkdirSync(constants, { recursive: true });
  copyFileSync(
    join(PACKAGE_DIR, 'src/constants/template-tests.json'),
    join(constants, 'template-tests.json'),
  );
  writeFileSync(join(fixture, 'template.manifest.json'), '{"features":{}}');
  return fixture;
}

export function buildTemplate(roots: string[], setup: (fixture: string) => void): string {
  const fixture = newFixture(roots);
  setup(fixture);
  runScript(fixture);
  return join(fixture, 'packages/create-nest-next-auth/template');
}
