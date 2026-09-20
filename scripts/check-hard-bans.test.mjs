import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FILE_LINE_LIMIT,
  countLines,
  evaluateChanges,
  findAttributionHits,
  findBannedToken,
  isCappedPath,
  isScanTarget,
  parseUnifiedDiff,
  stripAttribution,
} from './check-hard-bans.mjs';

function added(filePath, lines, lineStart = 1) {
  return {
    path: filePath,
    addedLines: lines.map((text, index) => ({ line: lineStart + index, text })),
  };
}

test('clean added source passes', () => {
  const result = evaluateChanges({
    added: [added('backend/src/health.ts', ['export const ok = true;'])],
    lineCounts: [{ path: 'backend/src/health.ts', lines: 40 }],
  });
  assert.equal(result.ok, true);
  assert.equal(result.bans.length, 0);
});

test('empty change set passes', () => {
  const result = evaluateChanges({ added: [], lineCounts: [] });
  assert.equal(result.ok, true);
});

test('added eslint-disable fails', () => {
  const result = evaluateChanges({
    added: [added('backend/src/app.ts', ['/* eslint-disable no-console */'])],
    lineCounts: [{ path: 'backend/src/app.ts', lines: 10 }],
  });
  assert.equal(result.ok, false);
  assert.equal(result.bans[0].token, 'eslint-disable');
});

test('added as any fails', () => {
  const result = evaluateChanges({
    added: [added('frontend/src/lib/parse.ts', ['const value = data as any;'])],
    lineCounts: [{ path: 'frontend/src/lib/parse.ts', lines: 10 }],
  });
  assert.equal(result.ok, false);
  assert.equal(result.bans[0].token, 'as any');
});

test('has any does not match as any', () => {
  assert.equal(findBannedToken('Check if a user has any of the required permissions'), null);
  assert.equal(findBannedToken('const value = data as any;'), 'as any');
});

test('added dangerouslySetInnerHTML fails', () => {
  const result = evaluateChanges({
    added: [added('frontend/src/ui/Html.tsx', ['return <div dangerouslySetInnerHTML={{ __html: html }} />;'])],
    lineCounts: [{ path: 'frontend/src/ui/Html.tsx', lines: 10 }],
  });
  assert.equal(result.ok, false);
  assert.equal(result.bans[0].token, 'dangerouslySetInnerHTML');
});

test('unchanged existing line is not scanned', () => {
  const result = evaluateChanges({
    added: [{ path: 'backend/src/auth.ts', addedLines: [] }],
    lineCounts: [{ path: 'backend/src/auth.ts', lines: 80 }],
  });
  assert.equal(result.ok, true);
});

test('denial assertion in a test file is allowed', () => {
  const result = evaluateChanges({
    added: [
      added('frontend/src/ui/Html.test.tsx', [
        "expect(source).not.toContain('dangerouslySetInnerHTML');",
      ]),
    ],
    lineCounts: [{ path: 'frontend/src/ui/Html.test.tsx', lines: 20 }],
  });
  assert.equal(result.ok, true);
});

test('real banned usage in a test file fails', () => {
  const result = evaluateChanges({
    added: [added('frontend/src/ui/Html.test.tsx', ["el.innerHTML = '<p>x</p>';"])],
    lineCounts: [{ path: 'frontend/src/ui/Html.test.tsx', lines: 20 }],
  });
  assert.equal(result.ok, false);
  assert.equal(result.bans[0].token, 'innerHTML');
});

test('markdown is not a scan target', () => {
  assert.equal(isScanTarget('docs/code-quality.md'), false);
  const result = evaluateChanges({
    added: [added('docs/code-quality.md', ['eslint-disable and --no-verify'])],
    lineCounts: [],
  });
  assert.equal(result.ok, true);
});

test('checker files are skipped', () => {
  const result = evaluateChanges({
    added: [added('scripts/check-hard-bans.mjs', ['const token = "as any";'])],
    lineCounts: [],
  });
  assert.equal(result.ok, true);
});

test('line cap: 350 passes and 351 fails under src', () => {
  const atLimit = evaluateChanges({
    added: [added('backend/src/long.ts', ['export {};'])],
    lineCounts: [{ path: 'backend/src/long.ts', lines: FILE_LINE_LIMIT }],
  });
  assert.equal(atLimit.ok, true);

  const over = evaluateChanges({
    added: [added('backend/src/long.ts', ['export {};'])],
    lineCounts: [{ path: 'backend/src/long.ts', lines: FILE_LINE_LIMIT + 1 }],
  });
  assert.equal(over.ok, false);
  assert.equal(over.caps[0].lines, FILE_LINE_LIMIT + 1);
});

test('root scripts over the cap are not gated', () => {
  assert.equal(isCappedPath('scripts/init.js'), false);
  const result = evaluateChanges({
    added: [added('scripts/init.js', ['console.log(1);'])],
    lineCounts: [{ path: 'scripts/init.js', lines: 500 }],
  });
  assert.equal(result.ok, true);
});

test('countLines matches visible lines', () => {
  assert.equal(countLines(''), 0);
  assert.equal(countLines('a\nb\n'), 2);
  assert.equal(countLines('a\nb'), 2);
});

test('parseUnifiedDiff reads added lines only', () => {
  const files = parseUnifiedDiff(`diff --git a/backend/src/a.ts b/backend/src/a.ts
--- a/backend/src/a.ts
+++ b/backend/src/a.ts
@@ -1,0 +2,2 @@
+const ok = true;
+const also = true;
`);
  assert.equal(files[0].path, 'backend/src/a.ts');
  assert.deepEqual(
    files[0].addedLines.map((row) => row.text),
    ['const ok = true;', 'const also = true;'],
  );
  assert.equal(files[0].addedLines[0].line, 2);
});

test('commit message attribution is stripped and leftover hits fail', () => {
  assert.equal(findAttributionHits('feat(root): add local gates\n').length, 0);
  const injected =
    'feat(root): add local gates\n\nCo-authored-by: Cursor <cursoragent@cursor.com>\n';
  assert.ok(findAttributionHits(injected).length > 0);
  const stripped = stripAttribution(injected);
  assert.equal(findAttributionHits(stripped).length, 0);
  assert.equal(stripped.includes('Co-authored-by'), false);
  assert.ok(findAttributionHits('feat: x\n\nGenerated with Claude\n').length > 0);
});

test('packages src is capped and husky hooks are scanned', () => {
  assert.equal(isCappedPath('packages/create-nest-next-auth/src/cli.ts'), true);
  assert.equal(isScanTarget('.husky/pre-commit'), true);
  assert.equal(isScanTarget('package.json'), true);
});
