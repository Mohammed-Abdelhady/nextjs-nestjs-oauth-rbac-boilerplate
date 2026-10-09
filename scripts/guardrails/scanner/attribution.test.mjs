import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { findAttributionHits, stripAttribution } from '../../check-hard-bans.mjs';

const ENTRY = fileURLToPath(new URL('../../check-hard-bans.mjs', import.meta.url));
const SUBJECT = 'feat(backend): add embeddings';
const CO_AUTHOR = 'tool co-author trailer';
const MADE_WITH = 'tool made-with trailer';
const FOOTER = 'tool generator footer';

const KEPT = [
  ['a human whose name contains a tool name', 'Co-authored-by: Jean-Claude Martin <jc@example.com>'],
  ['a human whose first name is a tool name', 'Co-authored-by: Claude Monet <claude.monet@example.com>'],
  ['a human whose surname follows a tool word', 'Co-authored-by: Cursor Vance <cv@example.com>'],
  ['prose that names a provider', 'Vectors are generated with the OpenAI embeddings API.'],
  ['generator words inside a sentence', 'The report is generated with the Cursor API and cached.'],
  ['a footer form that carries on as prose', 'Generated with Copilot suggestions switched off'],
  ['a link to provider documentation', 'See https://docs.anthropic.com/claude for the request format.'],
  ['a quoted trailer example', 'Example: "Co-Authored-By: Claude <noreply@anthropic.com>" is removed.'],
  ['a quoted footer example', '> Generated with Claude Code'],
  ['a footer example in a list', '- Generated with Cursor'],
  ['prose that gives a bot address', 'Mail cursoragent@cursor.com about the outage.'],
  ['a subject that names two providers', 'fix(backend): retry Claude and OpenAI calls'],
  ['another trailer that names a tool', 'Refs: Claude provider ticket 42'],
];

const REMOVED = [
  ['the Cursor trailer', 'Co-authored-by: Cursor <cursoragent@cursor.com>', CO_AUTHOR],
  ['the Claude trailer', 'Co-Authored-By: Claude <noreply@anthropic.com>', CO_AUTHOR],
  [
    'a trailer with a model and context size',
    'Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>',
    CO_AUTHOR,
  ],
  ['lower case and wide spacing', 'co-authored-by:   claude code   <noreply@anthropic.com>', CO_AUTHOR],
  ['upper case, no space and no address', 'CO-AUTHORED-BY:Cursor', CO_AUTHOR],
  ['a bot address under another name', 'Co-authored-by: Pair Helper <cursoragent@cursor.com>', CO_AUTHOR],
  [
    'the numbered Copilot address',
    'Co-authored-by: Copilot <198982749+Copilot@users.noreply.github.com>',
    CO_AUTHOR,
  ],
  ['a model name with a version', 'Co-authored-by: GPT-4o <noreply@openai.com>', CO_AUTHOR],
  ['a trailer that ends with a carriage return', 'Co-authored-by: ChatGPT <noreply@openai.com>\r', CO_AUTHOR],
  ['an indented trailer', '  Co-authored-by: Anthropic <noreply@anthropic.com>', CO_AUTHOR],
  ['the made-with trailer', 'Made-with: Cursor', MADE_WITH],
  ['the made-with trailer in lower case', 'made-with:cursor', MADE_WITH],
  [
    'the linked footer with an emoji',
    '\u{1F916} Generated with [Claude Code](https://claude.com/claude-code)',
    FOOTER,
  ],
  ['the bare footer', 'Generated with Cursor', FOOTER],
  ['a footer in lower case with wide spacing and a full stop', '  generated   with ChatGPT.', FOOTER],
  [
    'a footer followed by a link',
    'Generated with GitHub Copilot https://github.com/features/copilot',
    FOOTER,
  ],
];

for (const [name, line] of KEPT) {
  test(`kept: ${name}`, () => {
    const message = `${SUBJECT}\n\n${line}\n`;
    assert.equal(stripAttribution(message), message);
    assert.deepEqual(findAttributionHits(message), []);
  });
}

for (const [name, line, reason] of REMOVED) {
  test(`removed: ${name}`, () => {
    const message = `${SUBJECT}\n\nBody line.\n\n${line}\n`;
    assert.equal(stripAttribution(message), `${SUBJECT}\n\nBody line.\n`);
    assert.deepEqual(findAttributionHits(message), [reason]);
  });
}

test('only the tool lines leave a message that mixes them with human lines', () => {
  const message = [
    SUBJECT,
    '',
    'Vectors are generated with the OpenAI embeddings API.',
    '',
    'Co-authored-by: Jean-Claude Martin <jc@example.com>',
    'Co-Authored-By: Claude <noreply@anthropic.com>',
    'Generated with Cursor',
    '',
  ].join('\n');
  assert.equal(
    stripAttribution(message),
    [
      SUBJECT,
      '',
      'Vectors are generated with the OpenAI embeddings API.',
      '',
      'Co-authored-by: Jean-Claude Martin <jc@example.com>',
      '',
    ].join('\n'),
  );
});

test('a message with nothing to remove comes back byte for byte', () => {
  for (const message of ['', 'feat: x', 'feat: x\n\n\n', 'feat: x\r\n\r\nBody\r\n']) {
    assert.equal(stripAttribution(message), message);
  }
});

test('a tool trailer folded across two lines is a hit that stripping leaves in place', () => {
  for (const folded of [
    'Co-authored-by:\nCursor',
    'co-authored-by:  \r\n  Claude <noreply@anthropic.com>\r',
    'Co-authored-by:\nPair Helper <cursoragent@cursor.com>',
    'Made-with:\n Cursor',
  ]) {
    const message = `${SUBJECT}\n\n${folded}\n`;
    assert.equal(stripAttribution(message), message);
    assert.deepEqual(findAttributionHits(message), ['tool trailer folded across lines']);
  }
});

test('a human trailer folded across two lines is not a hit', () => {
  for (const folded of [
    'Co-authored-by:\nJean-Claude Martin <jc@example.com>',
    'Co-authored-by:\nClaude Monet <claude.monet@example.com>',
    'Co-authored-by:\n\nCursor',
    'Refs:\nCursor',
  ]) {
    assert.deepEqual(findAttributionHits(`${SUBJECT}\n\n${folded}\n`), []);
  }
});

test('the hook refuses a folded tool trailer and leaves the message as written', (t) => {
  const message = `${SUBJECT}\n\nCo-authored-by:\nCursor\n`;
  assert.deepEqual(runHook(t, message), {
    status: 2,
    stderr: 'Guardrails could not run: Commit message credits a tool. Commit as the author only.\n',
    message,
  });
});

function runHook(t, message) {
  const directory = mkdtempSync(join(tmpdir(), 'commit-message-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const file = join(directory, 'COMMIT_EDITMSG');
  writeFileSync(file, message);
  const result = spawnSync(process.execPath, [ENTRY, '--commit-msg', file], { encoding: 'utf8' });
  return { status: result.status, stderr: result.stderr, message: readFileSync(file, 'utf8') };
}

test('the hook keeps the reported human lines and stays silent', (t) => {
  const message = [
    SUBJECT,
    '',
    'Vectors are generated with the OpenAI embeddings API.',
    '',
    'Co-authored-by: Jean-Claude Martin <jc@example.com>',
    '',
  ].join('\n');
  assert.deepEqual(runHook(t, message), { status: 0, stderr: '', message });
});

test('the hook prints every line it removes with its line number and reason', (t) => {
  const message = [
    SUBJECT,
    '',
    'Body line.',
    '',
    'Co-Authored-By: Claude <noreply@anthropic.com>',
    'Made-with: Cursor',
    'Generated with Cursor',
    '',
  ].join('\n');
  assert.deepEqual(runHook(t, message), {
    status: 0,
    stderr: [
      'Removed commit message line 5 (tool co-author trailer): Co-Authored-By: Claude <noreply@anthropic.com>',
      'Removed commit message line 6 (tool made-with trailer): Made-with: Cursor',
      'Removed commit message line 7 (tool generator footer): Generated with Cursor',
      '',
    ].join('\n'),
    message: `${SUBJECT}\n\nBody line.\n`,
  });
});
