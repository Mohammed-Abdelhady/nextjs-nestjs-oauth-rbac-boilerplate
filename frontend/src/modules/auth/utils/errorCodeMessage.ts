import { ErrorCode, getErrorCodeTranslationKey, parseApiError } from '@app/core';

const TRANSLATED_CODES = new Set<string>(Object.values(ErrorCode));

/**
 * The error code to look up under `errors.codes`. A backend that grows a new
 * code answers with the fallback rather than an untranslated key.
 */
export function translatableErrorCode(
  error: unknown,
  fallback: string = ErrorCode.INTERNAL_ERROR,
): string {
  const { code, translationKey } = parseApiError(error);
  // The parser defaults to INTERNAL_ERROR when the response has no code.
  return TRANSLATED_CODES.has(code) && translationKey === getErrorCodeTranslationKey(code)
    ? code
    : fallback;
}
