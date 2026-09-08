import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { stripEnvVars } from '../src/prune/env.js';
import { prune } from '../src/prune/index.js';
import { listFiles } from '../src/utils/fs.js';
import { createFixtureTree, FIXTURE_MANIFEST } from './fixture.js';

const roots: string[] = [];

async function fixture(): Promise<string> {
  const root = await createFixtureTree();
  roots.push(root);
  return root;
}

afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

describe('prune', () => {
  it('deletes only what the unselected features own', async () => {
    const root = await fixture();
    const result = await prune(root, FIXTURE_MANIFEST, ['email-password', 'alpha']);
    const files = await listFiles(root);

    expect(result.deletedFiles).toEqual([
      'docs/setup-beta.md',
      'src/strategies/beta-oauth.strategy.ts',
      'tooling/internal.md',
    ]);
    expect(files).toContain('src/strategies/alpha-oauth.strategy.ts');
    expect(files).toContain('src/strategies/alpha-oauth.strategy.spec.ts');
    expect(files).toContain('docs/setup-alpha.md');
    expect(files).toContain('docs/setup-smtp.md');
    expect(files).not.toContain('src/strategies/beta-oauth.strategy.ts');
    expect(files).not.toContain('tooling/internal.md');
    expect(result.dangling).toEqual([]);
  });

  it('strips the env lines of removed features and keeps shared ones', async () => {
    const root = await fixture();
    const result = await prune(root, FIXTURE_MANIFEST, ['email-password', 'alpha']);

    const backend = await readFile(join(root, 'backend/.env.example'), 'utf8');
    const docker = await readFile(join(root, '.env.docker.example'), 'utf8');

    expect(result.strippedEnvVars).toEqual(['OAUTH_BETA_CLIENT_ID']);
    expect(backend).not.toContain('OAUTH_BETA_CLIENT_ID');
    expect(backend).not.toContain('# Beta OAuth');
    expect(backend).toContain('# OAUTH_ALPHA_CLIENT_ID=alpha-id');
    expect(backend).toContain('SHARED_KEY=shared');
    expect(backend).toContain('SWAGGER_ENABLED=false');
    expect(docker).not.toContain('OAUTH_BETA_CLIENT_ID');
    expect(docker).toContain('NEXT_PUBLIC_API_URL=http://localhost:5000');
  });

  it('keeps a shared var when only one of its owners is removed', async () => {
    const root = await fixture();
    await prune(root, FIXTURE_MANIFEST, ['email-password']);
    const backend = await readFile(join(root, 'backend/.env.example'), 'utf8');

    expect(backend).toContain('SHARED_KEY=shared');
    expect(backend).not.toContain('OAUTH_ALPHA_CLIENT_ID');
  });

  it('records the enabled features in the backend env example', async () => {
    const root = await fixture();
    await prune(root, FIXTURE_MANIFEST, ['email-password', 'alpha']);
    const backend = await readFile(join(root, 'backend/.env.example'), 'utf8');

    expect(backend).toContain('AUTH_FEATURES=email-password,alpha');
    expect(backend.match(/AUTH_FEATURES=/g)).toHaveLength(1);
  });

  it('removes doc links from lists and tables, and leaves the rest', async () => {
    const root = await fixture();
    const result = await prune(root, FIXTURE_MANIFEST, ['email-password', 'alpha']);

    const docsIndex = await readFile(join(root, 'docs/README.md'), 'utf8');
    const readme = await readFile(join(root, 'README.md'), 'utf8');

    expect(result.removedDocLines).toBe(2);
    expect(docsIndex).not.toContain('setup-beta.md');
    expect(docsIndex).toContain('setup-alpha.md');
    expect(readme).not.toContain('docs/setup-beta.md');
    expect(readme).toContain('| Guide | Description |');
  });

  it('reports imports left pointing at deleted files', async () => {
    const root = await fixture();
    const result = await prune(root, FIXTURE_MANIFEST, ['email-password', 'beta']);

    expect(result.dangling).toHaveLength(1);
    expect(result.dangling[0]).toMatchObject({
      file: 'src/auth.module.ts',
      line: 1,
      specifier: './strategies/alpha-oauth.strategy',
    });
  });

  it('removes planned features that never made it into the prompt', async () => {
    const root = await fixture();
    const result = await prune(root, FIXTURE_MANIFEST, ['email-password', 'alpha', 'beta']);
    expect(result.removed).toEqual(['gamma']);
  });
});

describe('stripEnvVars', () => {
  it('drops a commented assignment and the comment above it', () => {
    const content = ['# Beta OAuth (optional)', '# OAUTH_BETA_CLIENT_ID=id', ''].join('\n');
    const result = stripEnvVars(content, new Map([['OAUTH_BETA_CLIENT_ID', ['Beta', 'beta']]]));

    expect(result.content.trim()).toBe('');
    expect(result.stripped).toEqual(['OAUTH_BETA_CLIENT_ID']);
  });

  it('keeps a comment that does not name the feature', () => {
    const content = ['# Rate limiting', 'OAUTH_BETA_CLIENT_ID=id', 'THROTTLE_TTL=60'].join('\n');
    const result = stripEnvVars(content, new Map([['OAUTH_BETA_CLIENT_ID', ['Beta', 'beta']]]));

    expect(result.content).toContain('# Rate limiting');
    expect(result.content).toContain('THROTTLE_TTL=60');
  });

  it('leaves a file with no removals alone apart from the trailing newline', () => {
    const content = 'A=1\nB=2\n';
    expect(stripEnvVars(content, new Map()).content).toBe(content);
  });
});
