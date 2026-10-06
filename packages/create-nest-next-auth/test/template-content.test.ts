import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { TEMPLATE_IDENTITY_FILE } from '../src/constants/index.js';
import { buildTemplate } from './sync-template-fixture.js';

const roots: string[] = [];
const DOC_PATH = 'docs/code-quality.md';
const POLICY_PATH = 'scripts/guardrails/policy.mjs';
const ROOT_ONLY_START = '<!-- repository-only:start -->';
const ROOT_ONLY_END = '<!-- repository-only:end -->';

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function copyContent(path: string, content: string): string {
  return buildTemplate(roots, (fixture) => {
    mkdirSync(dirname(join(fixture, path)), { recursive: true });
    writeFileSync(join(fixture, path), content);
  });
}

function identity(template: string): unknown {
  const data: unknown = JSON.parse(
    readFileSync(join(dirname(template), TEMPLATE_IDENTITY_FILE), 'utf8'),
  );
  return (data as { sha256: unknown }).sha256;
}

describe('generated guardrail content', () => {
  it('keeps policy data exempt and removes exemptions for absent regression tests', () => {
    const template = copyContent(
      POLICY_PATH,
      "export const EXEMPT_PATHS = ['scripts/guardrails/policy.mjs', 'scripts/check-hard-bans.test.mjs'];\n",
    );
    const output = execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '--eval',
        `import { EXEMPT_PATHS } from './${POLICY_PATH}'; console.log(JSON.stringify(EXEMPT_PATHS));`,
      ],
      { cwd: template, encoding: 'utf8' },
    );
    expect(JSON.parse(output)).toEqual(['scripts/guardrails/policy.mjs']);
  });

  it('copies applicable instructions and omits repository-only tooling', () => {
    const template = copyContent(
      DOC_PATH,
      `Run the checker.\n${ROOT_ONLY_START}\nRoot policy suites.\n${ROOT_ONLY_END}\nRun application tests.\n`,
    );
    expect(readFileSync(join(template, DOC_PATH), 'utf8')).toBe(
      'Run the checker.\nRun application tests.\n',
    );
  });

  it('omits repository setup from the shipped root README', () => {
    const template = copyContent(
      'README.md',
      `# App\n${ROOT_ONLY_START}\ngit clone repository\npnpm install --frozen-lockfile\n${ROOT_ONLY_END}\npnpm install\n`,
    );
    expect(readFileSync(join(template, 'README.md'), 'utf8')).toBe('# App\npnpm install\n');
  });

  it('hashes shipped bytes rather than omitted documentation', () => {
    const first = copyContent(DOC_PATH, `Keep.\n${ROOT_ONLY_START}\nFirst.\n${ROOT_ONLY_END}\n`);
    const second = copyContent(DOC_PATH, `Keep.\n${ROOT_ONLY_START}\nSecond.\n${ROOT_ONLY_END}\n`);
    const changed = copyContent(
      DOC_PATH,
      `Changed.\n${ROOT_ONLY_START}\nFirst.\n${ROOT_ONLY_END}\n`,
    );
    expect([identity(first), identity(second), identity(changed)]).toEqual([
      'ebe22b804ece704685702bd2b488b030931c723a659187983efc0c140c7760a4',
      'ebe22b804ece704685702bd2b488b030931c723a659187983efc0c140c7760a4',
      '6aa63c9747902824d74396fbed928943da36fd9ccbfc2fcc84df372393a78bc9',
    ]);
  });
});
