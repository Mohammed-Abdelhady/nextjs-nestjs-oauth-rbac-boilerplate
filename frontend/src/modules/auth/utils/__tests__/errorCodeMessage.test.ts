import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ErrorCode } from '@/constants/errorCodes';
import { translatableErrorCode } from '../errorCodeMessage';

/** Reads the keys under errors.codes as text, so duplicates cannot hide one. */
function messageCodes(locale: string): Set<string> {
  const raw = readFileSync(
    fileURLToPath(new URL(`../../../../i18n/messages/${locale}.json`, import.meta.url)),
    'utf8',
  );
  const start = raw.indexOf('"codes": {');
  const block = raw.slice(start, raw.indexOf('\n    }', start));
  return new Set([...block.matchAll(/"([A-Z_]+)":/g)].map((match) => match[1]));
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
