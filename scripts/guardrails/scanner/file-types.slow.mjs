import assert from 'node:assert/strict';
import test from 'node:test';
import { repository, outcome } from '../test-repository.mjs';

const FLAG = '--no-' + 'verify';
const STYLE = ['stylelint', 'disable'].join('-');

const CASES = [
  ['.github/workflows/ci.yml', `steps:\n  - run: git commit ${FLAG} -m release\n`, 2, FLAG],
  ['docker-compose.yaml', `services:\n  app:\n    command: git push ${FLAG}\n`, 3, FLAG],
  ['backend/Dockerfile', `FROM node:22\nRUN git commit ${FLAG} -m build\n`, 2, FLAG],
  ['frontend/Dockerfile.dev', `RUN git commit ${FLAG} -m build\n`, 1, FLAG],
  ['frontend/src/app/globals.css', `.a { color: red; }\n/* ${STYLE}-next-line */\n`, 2, STYLE],
];

for (const [path, content, line, token] of CASES) {
  test(`a staged ${path} is refused, then passes once the line is gone`, (t) => {
    const repo = repository(t);
    repo.write(path, content);
    repo.git('add', '.');
    const refused = { status: 1, hits: [[path, line, token]], caps: [] };
    assert.deepEqual(outcome(repo.check('--staged')), refused);
    assert.deepEqual(outcome(repo.check('--all')), refused);

    repo.write(path, content.split('\n').filter((text) => !text.includes(token)).join('\n'));
    repo.git('add', '.');
    const clean = { status: 0, hits: [], caps: [] };
    assert.deepEqual(outcome(repo.check('--staged')), clean);
    assert.deepEqual(outcome(repo.check('--all')), clean);
  });
}

test('only the added line of a committed workflow is read in a range', (t) => {
  const repo = repository(t);
  repo.write('.github/workflows/ci.yml', 'steps:\n  - run: pnpm run lint\n');
  const base = repo.commit();
  repo.write('.github/workflows/ci.yml', `steps:\n  - run: pnpm run lint\n  - run: git push ${FLAG}\n`);
  const head = repo.commit();
  const result = repo.check('--range', base, head);
  assert.deepEqual(outcome(result), {
    status: 1,
    hits: [['.github/workflows/ci.yml', 3, FLAG]],
    caps: [],
  });
});
