import assert from 'node:assert/strict';
import test from 'node:test';
import { outcome, repository } from './test-repository.mjs';

const TOKEN = 'inner' + 'HTML';
const BAD = `node.${TOKEN} = value;\n`;
const CLEAN = 'export const value = 1;\n';
const ZERO = '0'.repeat(40);
const record = (local, remote = ZERO, ref = 'feature') =>
  `refs/heads/${ref} ${local} refs/heads/${ref} ${remote}\n`;
const PASS = { status: 0, hits: [], caps: [] };

function destination(t, repo, name = 'origin') {
  const remote = repository(t, ['--bare']);
  repo.git('remote', 'add', name, remote.root);
  return remote;
}

function inherited(t) {
  const repo = repository(t);
  repo.write('src/legacy.ts', BAD);
  const legacy = repo.commit();
  const remote = destination(t, repo);
  repo.git('push', 'origin', 'feature');
  return { repo, remote, legacy };
}

test('named destination tracking excludes inherited content for a clean new branch', (t) => {
  const { repo } = inherited(t);
  repo.git('switch', '-c', 'other');
  repo.write('src/clean.ts', CLEAN);
  const head = repo.commit();
  assert.deepEqual(
    outcome(repo.checkInput(record(head, ZERO, 'other'), '--push', '--hook', 'origin')),
    PASS,
  );
  repo.write('src/mine.ts', BAD);
  const dirty = repo.commit();
  assert.deepEqual(
    outcome(repo.checkInput(record(dirty, ZERO, 'other'), '--push', '--hook', 'origin')),
    {
      status: 1,
      hits: [['src/mine.ts', 1, TOKEN]],
      caps: [],
    },
  );
});

test('named destination keeps isolation and an unknown URL requires explicit tracking trust', (t) => {
  const repo = repository(t);
  repo.write('src/root.ts', CLEAN);
  repo.commit();
  destination(t, repo, 'destination');
  destination(t, repo, 'elsewhere');
  repo.write('src/elsewhere.ts', BAD);
  const head = repo.commit();
  repo.git('push', 'elsewhere', 'feature');
  assert.deepEqual(outcome(repo.checkInput(record(head), '--push', '--hook', 'destination')), {
    status: 1,
    hits: [['src/elsewhere.ts', 1, TOKEN]],
    caps: [],
  });
  const unknown = repository(t, ['--bare']);
  assert.deepEqual(outcome(repo.checkInput(record(head), '--push', '--hook', unknown.root)), {
    status: 1,
    hits: [['src/elsewhere.ts', 1, TOKEN]],
    caps: [],
  });
  repo.git('config', 'guardrails.trustedRemotes', 'elsewhere');
  assert.deepEqual(outcome(repo.checkInput(record(head), '--push', '--hook', unknown.root)), PASS);
});

for (const operation of ['rebase', 'merge']) {
  test(`a ${operation} onto moved destination history excludes inherited lines but checks own commits`, (t) => {
    const repo = repository(t);
    repo.write('src/root.ts', CLEAN);
    repo.commit();
    destination(t, repo);
    repo.git('push', 'origin', 'feature');
    repo.git('switch', '-c', 'topic');
    repo.write('src/topic.ts', CLEAN);
    const old = repo.commit();
    repo.git('push', 'origin', 'topic');
    repo.git('switch', 'feature');
    repo.write('src/inherited.ts', BAD);
    repo.commit();
    repo.git('push', 'origin', 'feature');
    repo.git('switch', 'topic');
    if (operation === 'rebase') repo.git('rebase', 'feature');
    else repo.git('merge', '--no-edit', 'feature');
    const moved = repo.git('rev-parse', 'HEAD');
    assert.deepEqual(
      outcome(repo.checkInput(record(moved, old, 'topic'), '--push', '--hook', 'origin')),
      PASS,
    );
    repo.write('src/own.ts', BAD);
    const dirty = repo.commit();
    assert.deepEqual(
      outcome(repo.checkInput(record(dirty, old, 'topic'), '--push', '--hook', 'origin')),
      {
        status: 1,
        hits: [['src/own.ts', 1, TOKEN]],
        caps: [],
      },
    );
  });
}

test('deleting one ref supplies the remote history excluded from another new ref', (t) => {
  const repo = repository(t);
  repo.write('src/inherited.ts', BAD);
  const old = repo.commit();
  repo.write('src/new.ts', CLEAN);
  const head = repo.commit();
  const input = record(ZERO, old, 'gone') + record(head, ZERO, 'new');
  assert.deepEqual(
    outcome(repo.checkInput(input, '--push', '--hook', '/scratch/remote.git')),
    PASS,
  );
});

test('clean amended commits pass while dirty amendments retain path line and token', (t) => {
  const { repo, legacy } = inherited(t);
  repo.write('src/amended.ts', CLEAN);
  repo.commit();
  repo.write('src/amended.ts', CLEAN + 'export const other = 2;\n');
  repo.git('add', '.');
  repo.git('commit', '--amend', '--no-edit');
  assert.deepEqual(
    outcome(
      repo.checkInput(record(repo.git('rev-parse', 'HEAD'), legacy), '--push', '--hook', 'origin'),
    ),
    PASS,
  );
  repo.write('src/amended.ts', CLEAN + BAD);
  repo.git('add', '.');
  repo.git('commit', '--amend', '--no-edit');
  assert.deepEqual(
    outcome(
      repo.checkInput(record(repo.git('rev-parse', 'HEAD'), legacy), '--push', '--hook', 'origin'),
    ),
    {
      status: 1,
      hits: [['src/amended.ts', 2, TOKEN]],
      caps: [],
    },
  );
});

for (const kind of ['lightweight', 'annotated']) {
  test(`${kind} commit tags scan their commit while tree and blob tags are not code`, (t) => {
    const repo = repository(t);
    repo.write('src/tagged.ts', BAD);
    repo.commit();
    if (kind === 'annotated') repo.git('tag', '-a', '-m', 'fixture', 'code');
    else repo.git('tag', 'code');
    const code = repo.git('rev-parse', 'code');
    assert.deepEqual(
      outcome(
        repo.checkInput(
          `refs/tags/code ${code} refs/tags/code ${ZERO}\n`,
          '--push',
          '--hook',
          'origin',
        ),
      ),
      {
        status: 1,
        hits: [['src/tagged.ts', 1, TOKEN]],
        caps: [],
      },
    );
    repo.git('tag', '-a', '-m', 'fixture', 'tree', 'HEAD^{tree}');
    repo.git('tag', 'blob', 'HEAD:src/tagged.ts');
    for (const ref of ['tree', 'blob']) {
      assert.deepEqual(
        outcome(
          repo.checkInput(
            `refs/tags/${ref} ${repo.git('rev-parse', ref)} refs/tags/${ref} ${ZERO}\n`,
            '--push',
            '--hook',
            'origin',
          ),
        ),
        PASS,
      );
    }
  });
}

test('unknown remote object IDs do not block clean history or hide an own violation', (t) => {
  const repo = repository(t);
  repo.write('src/root.ts', CLEAN);
  const clean = repo.commit();
  const unknown = 'f'.repeat(40);
  assert.deepEqual(
    outcome(repo.checkInput(record(clean, unknown), '--push', '--hook', 'origin')),
    PASS,
  );
  repo.write('src/mine.ts', BAD);
  const dirty = repo.commit();
  assert.deepEqual(outcome(repo.checkInput(record(dirty, unknown), '--push', '--hook', 'origin')), {
    status: 1,
    hits: [['src/mine.ts', 1, TOKEN]],
    caps: [],
  });
});

test('an intermediate violation reports its own short object ID after removal at the tip', (t) => {
  const repo = repository(t);
  repo.write('src/root.ts', CLEAN);
  const remote = repo.commit();
  repo.write('src/temporary.ts', BAD);
  const intermediate = repo.commit();
  repo.git('rm', 'src/temporary.ts');
  const head = repo.commit();
  const result = repo.checkInput(record(head, remote), '--push', '--hook', 'origin');
  assert.deepEqual(outcome(result), {
    status: 1,
    hits: [['src/temporary.ts', 1, TOKEN]],
    caps: [],
  });
  assert.equal(
    result.diagnostic.includes(`[${intermediate.slice(0, 7)}] src/temporary.ts:1:`),
    true,
  );
  assert.equal(result.diagnostic.includes(`[${head.slice(0, 7)}] src/temporary.ts:1:`), false);
});
