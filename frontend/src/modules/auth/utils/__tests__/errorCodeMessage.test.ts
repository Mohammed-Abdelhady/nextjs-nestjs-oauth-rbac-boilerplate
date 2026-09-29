import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ErrorCode } from '@/constants/errorCodes';
import { translatableErrorCode } from '../errorCodeMessage';

const MESSAGE_FILES = [
  'en.json',
  'ar.json',
  'session-authority.en.json',
  'session-authority.ar.json',
];

/** Reads the keys under errors.codes as text, so duplicates cannot hide one. */
function messageCodes(locale: string): Set<string> {
  const codes = new Set<string>();
  for (const name of MESSAGE_FILES) {
    if (!name.endsWith(`${locale}.json`)) continue;
    const raw = readFileSync(
      fileURLToPath(new URL(`../../../../i18n/messages/${name}`, import.meta.url)),
      'utf8',
    );
    const start = raw.indexOf('"codes": {');
    if (start === -1) continue;
    const close = raw.indexOf('\n    }', start);
    const block = close === -1 ? raw.slice(start) : raw.slice(start, close);
    for (const match of block.matchAll(/"([A-Z_]+)":/g)) {
      codes.add(match[1]);
    }
  }
  return codes;
}

function apiError(code: string): unknown {
  return { status: 400, data: { success: false, error: { code, message: code } } };
}

describe('translatableErrorCode', () => {
  it('returns the code the backend sent when it has a message', () => {
    expect(translatableErrorCode(apiError(ErrorCode.MAGIC_LINK_INVALID))).toBe(
      ErrorCode.MAGIC_LINK_INVALID,
    );
    expect(translatableErrorCode(apiError(ErrorCode.FEATURE_DISABLED))).toBe(
      ErrorCode.FEATURE_DISABLED,
    );
  });

  it.each([
    [409, 'SESSION_LIMIT_REACHED', 'errors.codes.SESSION_LIMIT_REACHED'],
    [503, 'AUTHORITY_UNAVAILABLE', 'errors.codes.AUTHORITY_UNAVAILABLE'],
  ])('selects the catalog key for a %i sign-in failure', (status, code, expectedKey) => {
    expect(
      `errors.codes.${translatableErrorCode({
        status,
        data: { success: false, error: { code, message: 'Backend message' } },
      })}`,
    ).toBe(expectedKey);
  });

  it('allows the caller to preserve its fallback for missing and unknown codes', () => {
    expect(translatableErrorCode({ status: 409, data: {} }, '')).toBe('');
    expect(translatableErrorCode(apiError('SOMETHING_NEW'), '')).toBe('');
  });

  it('falls back for a code this client does not know', () => {
    expect(translatableErrorCode(apiError('SOMETHING_NEW'))).toBe(ErrorCode.INTERNAL_ERROR);
    expect(translatableErrorCode(apiError('SOMETHING_NEW'), ErrorCode.MAGIC_LINK_INVALID)).toBe(
      ErrorCode.MAGIC_LINK_INVALID,
    );
  });

  it('never returns a code without a message in either locale', () => {
    const english = messageCodes('en');
    const arabic = messageCodes('ar');
    const untranslated = Object.values(ErrorCode).filter(
      (code) => !english.has(code) || !arabic.has(code),
    );

    expect(untranslated).toEqual([]);
  });
});
