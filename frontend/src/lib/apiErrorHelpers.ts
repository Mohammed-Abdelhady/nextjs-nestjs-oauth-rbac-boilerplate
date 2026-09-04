import { getErrorCodeTranslationKey } from '../constants/errorCodes';

/**
 * Extract field-level errors from validation error details
 */
export function extractFieldErrors(
  details?: Record<string, unknown>,
): Record<string, string[]> | undefined {
  if (!details || typeof details !== 'object') {
    return undefined;
  }

  // Handle NestJS class-validator format
  if ('errors' in details && Array.isArray(details.errors)) {
    const fieldErrors: Record<string, string[]> = {};

    for (const error of details.errors) {
      if (typeof error === 'object' && error !== null && 'field' in error && 'messages' in error) {
        const field = String(error.field);
        const messages = Array.isArray(error.messages)
          ? error.messages.map(String)
          : [String(error.messages)];
        fieldErrors[field] = messages;
      }
    }

    return Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined;
  }

  return undefined;
}

/**
 * Get translation key for HTTP status code
 */
export function getStatusCodeTranslationKey(statusCode?: number): string {
  if (!statusCode) {
    return getErrorCodeTranslationKey('UNKNOWN_ERROR');
  }

  switch (statusCode) {
    case 400:
      return getErrorCodeTranslationKey('VALIDATION_ERROR');
    case 401:
      return getErrorCodeTranslationKey('SESSION_EXPIRED');
    case 403:
      return getErrorCodeTranslationKey('FORBIDDEN');
    case 404:
      return getErrorCodeTranslationKey('NOT_FOUND');
    case 429:
      return getErrorCodeTranslationKey('RATE_LIMIT_EXCEEDED');
    case 500:
    case 502:
    case 503:
    case 504:
      return getErrorCodeTranslationKey('INTERNAL_ERROR');
    default:
      return getErrorCodeTranslationKey('UNKNOWN_ERROR');
  }
}
