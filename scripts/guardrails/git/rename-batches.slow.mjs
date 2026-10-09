import assert from 'node:assert/strict';
import test from 'node:test';
import { repository, outcome } from '../test-repository.mjs';

const TOKEN = 'inner' + 'HTML';
const BAD = `node.${TOKEN} = value;\n`;
const CLEAN = 'export const value = 1;\n';

for (const edited of [false, true]) {
  test(`ancestor rename preserves policy without reading excluded assets: edited=${edited}`, (t) => {
    const repo = repository(t);
    repo.write('src/a.ts', BAD + CLEAN.repeat(10));
    const base = repo.commit();
    repo.git('rm', 'src/a.ts');
    repo.write('src/a.ts/000-renamed.ts', BAD + CLEAN.repeat(10) + (edited ? BAD : ''));
    for (let index = 0; index < 1200; index += 1)
      repo.write(`src/a.ts/long-added-component-file-${index}.ts`, CLEAN);
    repo.write('src/a.ts/zzzz-last.ts', BAD);
    repo.write('src/a.ts/huge.png', Buffer.alloc(65 * 1024 * 1024));
    const head = repo.commit();
    assert.deepEqual(outcome(repo.check('--range', base, head)), {
      status: 1,
      hits: edited
        ? [
            ['src/a.ts/000-renamed.ts', 12, TOKEN],
            ['src/a.ts/zzzz-last.ts', 1, TOKEN],
          ]
        : [['src/a.ts/zzzz-last.ts', 1, TOKEN]],
      caps: [],
    });
  });
}

test('a dangling default remote falls through to a local candidate', (t) => {
  const repo = repository(t);
  repo.write('src/old.ts', BAD);
  const base = repo.commit();
  repo.git('update-ref', 'refs/heads/main', base);
  repo.git('symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/pruned');
  repo.write('src/new.ts', BAD);
  repo.commit();
  assert.deepEqual(outcome(repo.check('--push')), {
    status: 1,
    hits: [['src/new.ts', 1, TOKEN]],
    caps: [],
  });
});
