import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { scanTypography, typographyViolations } from './typography-policy.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const MODULE_FILE = 'frontend/src/modules/users/UserCard.tsx';
const PRIMITIVE_FILE = 'frontend/src/components/ui/card.tsx';

const found = (source, file = MODULE_FILE) =>
  typographyViolations(source, file).map(({ line, element, kind, token }) => ({
    line,
    element,
    kind,
    token,
  }));

test('no heading or description in the web app writes its own size or weight', () => {
  assert.deepEqual(scanTypography(ROOT), []);
});

test('a size or weight class on a role component is reported with its line', () => {
  const source = [
    '<div>',
    '  <Heading level={2} variant="sectionTitle" className="mt-4 text-xl">',
    '    Title',
    '  </Heading>',
    '  <CardTitle className="font-bold">Title</CardTitle>',
    '  <DialogDescription className="text-base">Body</DialogDescription>',
    '</div>',
  ].join('\n');

  assert.deepEqual(found(source), [
    { line: 2, element: 'Heading', kind: 'hand-written', token: 'text-xl' },
    { line: 5, element: 'CardTitle', kind: 'hand-written', token: 'font-bold' },
    { line: 6, element: 'DialogDescription', kind: 'hand-written', token: 'text-base' },
  ]);
});

test('responsive and arbitrary sizes count as hand-written', () => {
  assert.deepEqual(
    found('<Heading level={1} variant="display" className="xl:text-4xl text-[19px]" />'),
    [
      { line: 1, element: 'Heading', kind: 'hand-written', token: 'xl:text-4xl' },
      { line: 1, element: 'Heading', kind: 'hand-written', token: 'text-[19px]' },
    ],
  );
});

test('a numeric arbitrary weight counts as hand-written', () => {
  assert.deepEqual(found('<Heading level={2} variant="sectionTitle" className="font-[650]" />'), [
    { line: 1, element: 'Heading', kind: 'hand-written', token: 'font-[650]' },
  ]);
});

test('a heading element outside the primitives is reported even without classes', () => {
  assert.deepEqual(found('<h2 id="users">Users</h2>'), [
    { line: 1, element: 'h2', kind: 'raw-heading', token: 'h2' },
  ]);
});

test('a styled heading element outside the primitives reports both problems', () => {
  assert.deepEqual(found('<h3 className="text-sm font-medium">Name</h3>'), [
    { line: 1, element: 'h3', kind: 'hand-written', token: 'text-sm' },
    { line: 1, element: 'h3', kind: 'hand-written', token: 'font-medium' },
    { line: 1, element: 'h3', kind: 'raw-heading', token: 'h3' },
  ]);
});

test('a screen-reader-only heading element may stay raw', () => {
  assert.deepEqual(found('<h2 id="list" className="sr-only">List</h2>'), []);
});

test('a primitive may render a heading element but not size it by hand', () => {
  const viaRole = '<h3 ref={ref} className={cn(HEADING_ROLE_CLASSES.sectionTitle, className)} />';
  const byHand = "<h3 ref={ref} className={cn('text-2xl', className)} />";

  assert.deepEqual(found(viaRole, PRIMITIVE_FILE), []);
  assert.deepEqual(found(byHand, PRIMITIVE_FILE), [
    { line: 1, element: 'h3', kind: 'hand-written', token: 'text-2xl' },
  ]);
});

test('spacing, alignment, colour and font family classes are left to the call site', () => {
  const source =
    '<Heading level={1} variant="display" className="mt-6 text-center text-inherit font-mono truncate" />';

  assert.deepEqual(found(source), []);
});

test('a class after an arrow function attribute is still inside the tag', () => {
  const source =
    '<Heading level={2} variant="eyebrow" onClick={() => go(a > b)} className="text-lg" />';

  assert.deepEqual(found(source), [
    { line: 1, element: 'Heading', kind: 'hand-written', token: 'text-lg' },
  ]);
});

test('children, other elements and comments are not inspected', () => {
  const source = [
    '<Heading level={2} variant="sectionTitle">',
    '  <span className="text-xs font-bold">12</span>',
    '</Heading>',
    '<p className="text-sm font-medium">Body</p>',
    '<header className="text-lg">Bar</header>',
    '<HeadingGroup className="text-lg" />',
    '{/* <h2 className="text-lg">Old</h2> */}',
    '// <h2 className="text-lg">Old</h2>',
  ].join('\n');

  assert.deepEqual(found(source), []);
});

test('an empty source has no violations', () => {
  assert.deepEqual(found(''), []);
});

test('a project without the web app has nothing to scan', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'typography-policy-'));
  t.after(() => rmSync(root, { recursive: true }));

  assert.deepEqual(scanTypography(root), []);
});

test('the scan reads every component file under the source root', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'typography-policy-'));
  t.after(() => rmSync(root, { recursive: true }));
  mkdirSync(join(root, 'frontend/src/modules/a'), { recursive: true });
  mkdirSync(join(root, 'frontend/src/node_modules/b'), { recursive: true });
  writeFileSync(
    join(root, 'frontend/src/modules/a/A.tsx'),
    '<h1 className="sr-only">A</h1>\n<h2>B</h2>',
  );
  writeFileSync(join(root, 'frontend/src/modules/a/notes.ts'), '// <h2>ignored</h2>');
  writeFileSync(join(root, 'frontend/src/node_modules/b/B.tsx'), '<h2>ignored</h2>');

  assert.deepEqual(scanTypography(root), [
    {
      file: 'frontend/src/modules/a/A.tsx',
      line: 2,
      element: 'h2',
      kind: 'raw-heading',
      token: 'h2',
    },
  ]);
});
