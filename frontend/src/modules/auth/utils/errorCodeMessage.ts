import { ErrorCode } from '@/constants/errorCodes';
import { parseApiError } from '@/lib/apiError';

const TRANSLATED_CODES = new Set<string>(Object.values(ErrorCode));

/**
 * The error code to look up under `errors.codes`. A backend that grows a new
 * code answers with the fallback rather than an untranslated key.
 */
export function translatableErrorCode(
  error: unknown,
  fallback: string = ErrorCode.INTERNAL_ERROR,
): string {
  const { code } = parseApiError(error);
  return TRANSLATED_CODES.has(code) ? code : fallback;
}
