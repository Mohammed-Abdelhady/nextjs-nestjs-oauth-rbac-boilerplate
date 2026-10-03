import { execFileSync, spawnSync } from 'node:child_process';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { SHA256_HEX_PATTERN, TEMPLATE_IDENTITY_FILE } from '../src/constants/index.js';

const PACKAGE_DIR = fileURLToPath(new URL('..', import.meta.url));
const SCRIPT = join(PACKAGE_DIR, 'scripts/sync-template.mjs');

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function runScript(fixture: string): void {
  const script = join(fixture, 'packages/create-nest-next-auth/scripts/sync-template.mjs');
  execFileSync(process.execPath, [script], { timeout: 10_000, stdio: 'pipe' });
}

/** A fixture with the script and the default manifest in place, not yet run. */
function newFixture(): string {
  const fixture = mkdtempSync(join(tmpdir(), 'cna-sync-'));
  roots.push(fixture);
  const script = join(fixture, 'packages/create-nest-next-auth/scripts/sync-template.mjs');
  mkdirSync(dirname(script), { recursive: true });
  copyFileSync(SCRIPT, script);
  writeFileSync(join(fixture, 'template.manifest.json'), '{"features":{}}');
  return fixture;
}

/** Runs the script against a fixture and returns the template directory it wrote. */
function buildTemplate(setup: (fixture: string) => void): string {
  const fixture = newFixture();
  setup(fixture);
  runScript(fixture);
  return join(fixture, 'packages/create-nest-next-auth/template');
}

/** The fixture root a built template directory belongs to. */
function fixtureOf(template: string): string {
  return dirname(dirname(dirname(template)));
}

/** The identity the build shipped next to the given template directory. */
function identityOf(template: string): string {
  const path = join(dirname(template), TEMPLATE_IDENTITY_FILE);
  const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
  const sha256 = (parsed as { sha256?: unknown }).sha256;
  if (typeof sha256 !== 'string') throw new Error(`${path} does not carry a sha256`);
  return sha256;
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

describe('template identity', () => {
  it('ships a hex sha256 next to the template', () => {
    const template = buildTemplate((fixture) => {
      writeFileSync(join(fixture, 'app.txt'), 'one\n');
    });

    expect(identityOf(template)).toMatch(SHA256_HEX_PATTERN);
  });

  it('changes when a template file changes', () => {
    const first = identityOf(
      buildTemplate((fixture) => {
        writeFileSync(join(fixture, 'app.txt'), 'one\n');
      }),
    );
    const second = identityOf(
      buildTemplate((fixture) => {
        writeFileSync(join(fixture, 'app.txt'), 'two\n');
      }),
    );

    expect(first).not.toBe(second);
  });

  it('changes when the manifest changes', () => {
    const first = identityOf(
      buildTemplate((fixture) => {
        writeFileSync(join(fixture, 'app.txt'), 'one\n');
        writeFileSync(join(fixture, 'template.manifest.json'), '{"features":{}}');
      }),
    );
    const second = identityOf(
      buildTemplate((fixture) => {
        writeFileSync(join(fixture, 'app.txt'), 'one\n');
        writeFileSync(join(fixture, 'template.manifest.json'), '{"features":{},"version":2}');
      }),
    );

    expect(first).not.toBe(second);
  });

  it('is stable when the same tree is built twice', () => {
    const template = buildTemplate((fixture) => {
      writeFileSync(join(fixture, 'app.txt'), 'one\n');
    });
    const first = identityOf(template);
    runScript(fixtureOf(template));

    expect(identityOf(template)).toBe(first);
  });

  it('matches a hand-written digest for a known fixture', () => {
    // The recipe, applied by hand: entries are "<path>\0<exec>\0<sha256 hex>",
    // sorted as strings, joined with "\n", one trailing "\n" is appended, and
    // the whole payload is sha256'd. hello.txt = "hi\n" and the manifest is
    // {"features":{}}; neither file carries an executable bit, so both entries
    // hold "0". Payload sha256: 53e23961...d5f81fed (full value asserted).
    const template = buildTemplate((fixture) => {
      writeFileSync(join(fixture, 'hello.txt'), 'hi\n');
    });

    expect(identityOf(template)).toBe(
      '53e23961b81770af30bb7f9549504f84c25044369e210f2cfa91b706d5f81fed',
    );
  });

  it('is the same tree built in two different directories', () => {
    const first = identityOf(
      buildTemplate((fixture) => {
        writeFileSync(join(fixture, 'app.txt'), 'one\n');
      }),
    );
    const second = identityOf(
      buildTemplate((fixture) => {
        writeFileSync(join(fixture, 'app.txt'), 'one\n');
      }),
    );

    expect(first).toBe(second);
  });

  it('changes when a file is renamed', () => {
    const first = identityOf(
      buildTemplate((fixture) => {
        writeFileSync(join(fixture, 'a.txt'), 'same\n');
      }),
    );
    const second = identityOf(
      buildTemplate((fixture) => {
        writeFileSync(join(fixture, 'b.txt'), 'same\n');
      }),
    );

    expect(first).not.toBe(second);
  });

  it('changes when an empty file is added', () => {
    const first = identityOf(
      buildTemplate((fixture) => {
        writeFileSync(join(fixture, 'app.txt'), 'one\n');
      }),
    );
    const second = identityOf(
      buildTemplate((fixture) => {
        writeFileSync(join(fixture, 'app.txt'), 'one\n');
        writeFileSync(join(fixture, 'empty.txt'), '');
      }),
    );

    expect(first).not.toBe(second);
  });

  it('changes when a file becomes executable', () => {
    const template = buildTemplate((fixture) => {
      writeFileSync(join(fixture, 'hook.sh'), '#!/bin/sh\n');
    });
    const before = identityOf(template);
    const fixture = fixtureOf(template);
    chmodSync(join(fixture, 'hook.sh'), 0o755);
    runScript(fixture);

    expect(identityOf(template)).not.toBe(before);
  });

  it('matches a hand-written digest when a file name contains a newline', () => {
    // The same recipe as above, with the file name "a\nb" holding "hi\n". The
    // embedded newline stays inside its own NUL-framed entry and never
    // becomes a line break; the payload sorts "a\nb" before the manifest.
    const template = buildTemplate((fixture) => {
      writeFileSync(join(fixture, 'a\nb'), 'hi\n');
    });

    expect(identityOf(template)).toBe(
      '28e25cd743d6541884025ebb00482a61a59e5d71236a193249be770196bf6176',
    );
  });

  it('leaves no identity file behind when a build fails', () => {
    const fixture = newFixture();
    writeFileSync(join(fixture, '.gitignore'), 'ignored\n');
    writeFileSync(join(fixture, '_gitignore'), 'literal\n');
    const packageDir = join(fixture, 'packages/create-nest-next-auth');
    writeFileSync(join(packageDir, TEMPLATE_IDENTITY_FILE), '{"sha256":"deadbeef"}\n', 'utf8');
    const script = join(packageDir, 'scripts/sync-template.mjs');

    const result = spawnSync(process.execPath, [script], { timeout: 10_000, encoding: 'utf8' });

    expect(result.status).not.toBe(0);
    expect(existsSync(join(packageDir, TEMPLATE_IDENTITY_FILE))).toBe(false);
  });

  it('refuses two sources that would ship as one path', () => {
    const fixture = newFixture();
    writeFileSync(join(fixture, '.gitignore'), 'ignored\n');
    writeFileSync(join(fixture, '_gitignore'), 'literal\n');
    const script = join(fixture, 'packages/create-nest-next-auth/scripts/sync-template.mjs');

    const result = spawnSync(process.execPath, [script], { timeout: 10_000, encoding: 'utf8' });

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain('Two template files ship as _gitignore');
  });
});
