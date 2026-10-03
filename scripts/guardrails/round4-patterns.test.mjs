import assert from 'node:assert/strict';
import test from 'node:test';
import { findBannedToken } from './checker.mjs';
import { decodeContent, isUtf16 } from './text-content.mjs';

const CAST = 'as unk' + 'nown as';
const INLINE = 'inline eslint configuration';

for (const [name, bytes, text, encoded] of [
  ['LE', [255, 254, 97, 0, 10, 0], 'a\n', true],
  ['BE', [254, 255, 0, 97, 0, 10], 'a\n', true],
  ['UTF8', [97, 10], 'a\n', false],
  ['UTF8 BOM', [239, 187, 191, 97, 10], '\ufeffa\n', false],
  ['empty', [], '', false],
  ['truncated BOM', [255], '\ufffd', false],
  ['BOM only', [255, 254], '', true],
  ['truncated code unit', [255, 254, 97], '\ufffd', true],
]) {
  test(`source decoding and BOM detection: ${name}`, () => {
    const content = Buffer.from(bytes);
    assert.deepEqual(
      { text: decodeContent(content), encoded: isUtf16(content) },
      { text, encoded },
    );
  });
}

for (const [source, token] of [
  ['// es' + 'lint is run by lint-staged', null],
  ['/* es' + 'lint 9 requires flat config */', null],
  ['/* es' + 'lint rule names may contain a slash */', null],
  ['/* es' + 'lint no-alert: 0 */', INLINE],
  ['/* es' + 'lint "no-alert": "off" */', INLINE],
  ['/* es' + 'lint @typescript-eslint/no-explicit-' + 'a' + 'ny: 0 */', INLINE],
  ['(input as unk' + 'nown /* gap */) /* next */ as string;', CAST],
  ['(input as unk' + 'nown)as string;', CAST],
  ['fn(input as unk' + 'nown) as string;', null],
  ['input as unk' + 'nown/* gap */astring;', null],
  ['export const value = <T>(<unk' + 'nown>x);', CAST],
]) {
  test(`token spelling boundary: ${source}`, () => {
    assert.equal(findBannedToken(source), token);
  });
}
