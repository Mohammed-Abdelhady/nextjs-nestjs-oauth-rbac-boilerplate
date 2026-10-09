import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildNextSteps, readWorkspaceStartScripts } from '../../src/scaffold/next-steps.js';

const SCRIPTS = {
  backend: 'pnpm --filter backend run start:dev',
  frontend: 'pnpm --filter frontend run dev',
};

const roots: string[] = [];

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'cna-next-steps-'));
  roots.push(root);
  return root;
}

afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

describe('buildNextSteps', () => {
  it('prints only what the Docker path needs when docker is on', () => {
    expect(
      buildNextSteps({ directoryLabel: 'app', installed: true, docker: true, scripts: SCRIPTS }),
    ).toEqual([
      'cd app',
      'cp .env.docker.example .env.docker',
      'docker compose --env-file .env.docker up -d',
    ]);
  });

  it('ends with the mobile app command when the project has the app', () => {
    const mobile = 'pnpm --filter @app/mobile-expo run ios';

    expect(
      buildNextSteps({
        directoryLabel: 'app',
        installed: true,
        docker: true,
        scripts: SCRIPTS,
        mobile,
      }).slice(-2),
    ).toEqual([
      '# Mobile app on an iOS simulator (needs Xcode and CocoaPods, see "Mobile app" in README.md):',
      mobile,
    ]);
    expect(
      buildNextSteps({
        directoryLabel: 'app',
        installed: true,
        docker: false,
        scripts: SCRIPTS,
        mobile,
      }).at(-1),
    ).toBe(mobile);
  });

  it('prints the local replica-set path when docker is off', () => {
    expect(
      buildNextSteps({ directoryLabel: 'app', installed: false, docker: false, scripts: SCRIPTS }),
    ).toEqual([
      'cd app',
      'pnpm install',
      'cp backend/.env.example backend/.env',
      'cp frontend/.env.example frontend/.env.local',
      '# Start a single-node replica set (sign-in uses transactions):',
      'mkdir -p ./mongodb-data',
      'mongod --replSet rs0 --dbpath ./mongodb-data',
      '# leave mongod running, then in a second terminal:',
      'mongosh --eval "rs.initiate()"',
      '# set MONGO_URI with replicaSet=rs0 in backend/.env, then:',
      'pnpm --filter backend run start:dev',
      'pnpm --filter frontend run dev',
    ]);
  });
});

describe('readWorkspaceStartScripts', () => {
  it('reads the start scripts from the generated workspaces', async () => {
    const root = await tempRoot();
    for (const [workspace, name] of [
      ['backend', 'start:dev'],
      ['frontend', 'dev'],
    ] as const) {
      const path = join(root, workspace, 'package.json');
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, JSON.stringify({ scripts: { [name]: 'run' } }), 'utf8');
    }

    await expect(readWorkspaceStartScripts(root)).resolves.toEqual(SCRIPTS);
  });

  it('uses the fallback script when the preferred one is absent', async () => {
    const root = await tempRoot();
    for (const workspace of ['backend', 'frontend'] as const) {
      const path = join(root, workspace, 'package.json');
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, JSON.stringify({ scripts: { start: 'run' } }), 'utf8');
    }

    await expect(readWorkspaceStartScripts(root)).resolves.toEqual({
      backend: 'pnpm --filter backend run start',
      frontend: 'pnpm --filter frontend run start',
    });
  });

  it('uses the preferred name when a workspace has no package.json', async () => {
    const root = await tempRoot();

    await expect(readWorkspaceStartScripts(root)).resolves.toEqual(SCRIPTS);
  });
});
