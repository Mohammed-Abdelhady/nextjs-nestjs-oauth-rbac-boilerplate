import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const EXCEPTION_KEY = /^["']?minimumReleaseAgeExclude["']?\s*:(.*)$/;
const STRICT_KEY = /^["']?minimumReleaseAgeStrict["']?\s*:\s*true\s*(#.*)?$/m;
const AGE_KEY = /^["']?minimumReleaseAge["']?\s*:\s*(\d+)\s*(#.*)?$/m;
const LIST_ITEM = /^\s*-\s+/;
const BLANK_OR_COMMENT = /^\s*(#.*)?$/;
const unquote = (item) => item.trim().replace(/\s+#.*$/, '').replace(/^["']|["']$/g, '');

/** Every package the workspace file lets through the cooldown. None is expected. */
export function releaseAgeExceptions(source) {
  const lines = source.split(/\r?\n/);
  const start = lines.findIndex((line) => EXCEPTION_KEY.test(line));
  if (start === -1) return [];
  const inline = lines[start].match(EXCEPTION_KEY)[1].trim();
  const items = inline.startsWith('[') ? inline.slice(1, inline.lastIndexOf(']')).split(',') : [];
  for (const line of lines.slice(start + 1)) {
    if (LIST_ITEM.test(line)) items.push(line.replace(LIST_ITEM, ''));
    else if (!BLANK_OR_COMMENT.test(line)) break;
  }
  return items.map(unquote).filter(Boolean);
}

/** The cooldown in minutes the workspace file sets, or undefined when it leaves it to pnpm. */
export function releaseAgeMinutes(source) {
  const match = source.match(AGE_KEY);
  return match ? Number.parseInt(match[1], 10) : undefined;
}

const workspaceFile = () => readFileSync(join(ROOT, 'pnpm-workspace.yaml'), 'utf8');

test('the workspace file lets no package skip the release-age cooldown', () => {
  assert.deepEqual(releaseAgeExceptions(workspaceFile()), []);
});

test('the workspace file sets strict release-age mode and a 1440 minute cooldown', () => {
  assert.equal(STRICT_KEY.test(workspaceFile()), true);
  assert.equal(releaseAgeMinutes(workspaceFile()), 1440);
});

test('the cooldown has to be a written number of minutes, not the strict flag or a comment', () => {
  assert.equal(releaseAgeMinutes('minimumReleaseAge: 1440\n'), 1440);
  assert.equal(releaseAgeMinutes('a: 1\n"minimumReleaseAge":  60 # one hour\r\n'), 60);
  assert.equal(releaseAgeMinutes('minimumReleaseAge: 0\n'), 0);
  assert.equal(releaseAgeMinutes('minimumReleaseAgeStrict: true\n'), undefined);
  assert.equal(releaseAgeMinutes('# minimumReleaseAge: 1440\n'), undefined);
  assert.equal(releaseAgeMinutes('minimumReleaseAge: soon\n'), undefined);
  assert.equal(releaseAgeMinutes('minimumReleaseAge:\n'), undefined);
  assert.equal(releaseAgeMinutes(''), undefined);
});

test('exceptions written as a block are found, with and without quotes', () => {
  const source = [
    'packages:', '  - backend', '', 'minimumReleaseAgeExclude:',
    "  - '@expo/cli@57.0.28'", '  - expo@57.0.27  # too new', '', '  - "left-pad"',
    'overrides:', '  - not-an-exception',
  ].join('\n');

  assert.deepEqual(releaseAgeExceptions(source), ['@expo/cli@57.0.28', 'expo@57.0.27', 'left-pad']);
});

test('exceptions are found without indentation, inline, and under a quoted key', () => {
  assert.deepEqual(releaseAgeExceptions('minimumReleaseAgeExclude:\n- expo@57.0.27\n'), [
    'expo@57.0.27',
  ]);
  assert.deepEqual(releaseAgeExceptions("minimumReleaseAgeExclude: [expo@57.0.27, 'a@1.0.0']\n"), [
    'expo@57.0.27', 'a@1.0.0',
  ]);
  assert.deepEqual(releaseAgeExceptions('"minimumReleaseAgeExclude":\r\n  - expo@57.0.27\r\n'), [
    'expo@57.0.27',
  ]);
});

test('an empty list, a comment and the other release-age settings are not exceptions', () => {
  assert.deepEqual(releaseAgeExceptions('minimumReleaseAgeExclude: []\npackages:\n  - a\n'), []);
  assert.deepEqual(releaseAgeExceptions('minimumReleaseAgeExclude:\npackages:\n  - a\n'), []);
  assert.deepEqual(releaseAgeExceptions('# minimumReleaseAgeExclude:\n#   - expo@57.0.27\n'), []);
  assert.deepEqual(releaseAgeExceptions('# minimumReleaseAgeExclude: [expo@57.0.27]\n'), []);
  assert.deepEqual(
    releaseAgeExceptions('minimumReleaseAge: 1440\nminimumReleaseAgeStrict: true\n'),
    [],
  );
});

test('strict mode has to be on, not merely named', () => {
  assert.equal(STRICT_KEY.test('minimumReleaseAgeStrict: true\n'), true);
  assert.equal(STRICT_KEY.test('a: 1\nminimumReleaseAgeStrict: true # stop\n'), true);
  assert.equal(STRICT_KEY.test('minimumReleaseAgeStrict: false\n'), false);
  assert.equal(STRICT_KEY.test('# minimumReleaseAgeStrict: true\n'), false);
  assert.equal(STRICT_KEY.test('packages:\n  - backend\n'), false);
});
