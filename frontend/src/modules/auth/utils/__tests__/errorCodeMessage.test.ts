import { describe, expect, it } from 'vitest';
import type { AbstractIntlMessages } from 'next-intl';
import { ErrorCode } from '@app/core';
import { loadMessages } from '@/i18n/load-messages';
import { isMessageTree } from '@/i18n/__tests__/message-tree';
import { translatableErrorCode } from '../errorCodeMessage';

function codesOf(messages: AbstractIntlMessages): Record<string, string> {
  const errors = messages['errors'];
  if (!isMessageTree(errors)) {
    throw new Error('Expected an errors message tree');
  }
  const codes = errors['codes'];
  if (!isMessageTree(codes)) {
    throw new Error('Expected an errors.codes message tree');
  }
  const flat: Record<string, string> = {};
  for (const [code, message] of Object.entries(codes)) {
    if (typeof message !== 'string') {
      throw new Error(`Expected a message string for code ${code}`);
    }
    flat[code] = message;
  }
  return flat;
}

function icuArgNames(message: string): string[] {
  const names = new Set<string>();
  const pattern = /\{(\w+)(?:\s*,|\s*\})/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(message)) !== null) {
    const name = match[1];
    if (name !== undefined) {
      names.add(name);
    }
  }
  return [...names].sort();
}

function apiError(code: string): unknown {
  return { status: 400, data: { success: false, error: { code, message: code } } };
}

describe('translatableErrorCode', () => {
  it('returns the code the backend sent when it has a message', () => {
    // feature:magic-link:start
    expect(translatableErrorCode(apiError(ErrorCode.MAGIC_LINK_INVALID))).toBe(
      ErrorCode.MAGIC_LINK_INVALID,
    );
    // feature:magic-link:end
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
    // feature:magic-link:start
    expect(translatableErrorCode(apiError('SOMETHING_NEW'), ErrorCode.MAGIC_LINK_INVALID)).toBe(
      ErrorCode.MAGIC_LINK_INVALID,
    );
    // feature:magic-link:end
  });

  it('resolves every known code through the real loader in both locales', async () => {
    const english = codesOf(await loadMessages('en'));
    const arabic = codesOf(await loadMessages('ar'));
    const untranslated = Object.values(ErrorCode).filter((code) => {
      const englishMessage = english[code];
      const arabicMessage = arabic[code];
      return (
        typeof englishMessage !== 'string' ||
        englishMessage.trim().length === 0 ||
        typeof arabicMessage !== 'string' ||
        arabicMessage.trim().length === 0
      );
    });

    expect(untranslated).toEqual([]);
  });

  it('keeps the same ICU arguments in English and Arabic for every code', async () => {
    const english = codesOf(await loadMessages('en'));
    const arabic = codesOf(await loadMessages('ar'));
    const mismatched = Object.values(ErrorCode).filter((code) => {
      const englishMessage = english[code];
      const arabicMessage = arabic[code];
      if (typeof englishMessage !== 'string' || typeof arabicMessage !== 'string') {
        return true;
      }
      return icuArgNames(englishMessage).join(',') !== icuArgNames(arabicMessage).join(',');
    });

    expect(mismatched).toEqual([]);
  });

  it.each([
    ['Hello {name}', ['name']],
    ['{count, plural, one {1 user} other {{count} users}}', ['count']],
    ['{first} and {second}', ['first', 'second']],
    ['No arguments here', []],
  ])('reads ICU arguments from %s', (message, expected) => {
    expect(icuArgNames(message)).toEqual(expected);
  });
});
