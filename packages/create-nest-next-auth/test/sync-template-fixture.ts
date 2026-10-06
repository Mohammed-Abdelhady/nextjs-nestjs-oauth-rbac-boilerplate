import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import TEMPLATE_SYNC_INPUTS from '../scripts/template-sync-inputs.json' with { type: 'json' };

const PACKAGE_DIR = fileURLToPath(new URL('..', import.meta.url));
const FIXTURE_PACKAGE = 'packages/create-nest-next-auth';

export function copySyncTemplateInputs(fixture: string): void {
  for (const file of Object.values(TEMPLATE_SYNC_INPUTS)) {
    const target = join(fixture, FIXTURE_PACKAGE, file);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(join(PACKAGE_DIR, file), target);
  }
}

export function runScript(fixture: string): void {
  const script = join(fixture, FIXTURE_PACKAGE, TEMPLATE_SYNC_INPUTS.script);
  execFileSync(process.execPath, [script], { timeout: 10_000, stdio: 'pipe' });
}

export function newFixture(roots: string[]): string {
  const fixture = mkdtempSync(join(tmpdir(), 'cna-sync-'));
  roots.push(fixture);
  copySyncTemplateInputs(fixture);
  writeFileSync(join(fixture, 'template.manifest.json'), '{"features":{}}');
  return fixture;
}

export function buildTemplate(roots: string[], setup: (fixture: string) => void): string {
  const fixture = newFixture(roots);
  setup(fixture);
  runScript(fixture);
  return join(fixture, 'packages/create-nest-next-auth/template');
}
