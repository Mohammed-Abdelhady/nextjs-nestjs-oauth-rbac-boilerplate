import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

for (const workspace of ['backend', 'frontend']) {
  test(`${workspace} image fetches the full graph before the offline frozen install`, async () => {
    const source = await readFile(new URL(`../${workspace}/Dockerfile`, import.meta.url), 'utf8');
    const lines = source.split('\n');
    assert.equal(
      lines.includes('RUN corepack enable && corepack prepare pnpm@12.6.0 --activate'),
      true,
    );
    assert.equal(lines.includes('COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./'), true);
    assert.equal(lines.includes('ENV MONGOMS_DISABLE_POSTINSTALL=1'), true);
    const fetch = lines.indexOf('RUN pnpm fetch');
    const copy = lines.indexOf('COPY . .');
    const install = lines.indexOf('RUN pnpm install --offline --frozen-lockfile');
    assert.ok(fetch >= 0 && fetch < copy && copy < install);
    assert.equal(lines.includes(`RUN pnpm --filter ${workspace} run build`), true);
  });
}

test('backend deploys production dependencies and copies the compiled entry point', async () => {
  const source = await readFile(new URL('../backend/Dockerfile', import.meta.url), 'utf8');
  assert.deepEqual(
    source.split('\n').filter((line) => line.startsWith('RUN pnpm --filter backend deploy')),
    ['RUN pnpm --filter backend deploy --prod --frozen-lockfile /out/backend'],
  );
  assert.match(source, /COPY --from=builder --chown=nestjs:nestjs \/out\/backend \.\//);
  assert.match(source, /COPY --from=builder --chown=nestjs:nestjs \/app\/backend\/dist \.\/dist/);
  assert.match(source, /CMD \["node", "dist\/main"\]/);
});

test('frontend keeps standalone output and Vercel uses the frozen pnpm graph', async () => {
  const source = await readFile(new URL('../frontend/Dockerfile', import.meta.url), 'utf8');
  assert.match(source, /\/app\/frontend\/\.next\/standalone \.\//);
  assert.match(source, /\/app\/frontend\/\.next\/static \.\/frontend\/\.next\/static/);
  assert.match(source, /CMD \["node", "server\.js"\]/);
  const vercel = JSON.parse(
    await readFile(new URL('../frontend/vercel.json', import.meta.url), 'utf8'),
  );
  assert.equal(vercel.buildCommand, 'corepack pnpm run build');
  assert.equal(vercel.devCommand, 'corepack pnpm run dev');
  assert.equal(vercel.installCommand, 'corepack prepare pnpm@12.6.0 --activate && corepack pnpm install --frozen-lockfile');
});
