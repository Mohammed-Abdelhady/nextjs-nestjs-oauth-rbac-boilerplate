/**
 * API Error Handling Utility
 *
 * Centralized error handling for API responses with i18n support.
 * Extracts error codes from backend responses and provides translated messages.
 */

import { ErrorCode, getErrorCodeTranslationKey } from '../constants/errorCodes';
import type { ApiErrorResponse, ParsedApiError, RtkQueryError } from '../types/apiError.types';
import { extractFieldErrors, getStatusCodeTranslationKey } from './apiErrorHelpers';

export type { ApiErrorResponse, ParsedApiError, RtkQueryError };

/**
 * Check if an error is an RTK Query error
 */
export function isRtkQueryError(error: unknown): error is RtkQueryError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    ('data' in error || 'error' in error)
  );
}

/**
 * Check if an error response has the expected API error structure
 */
function isApiErrorResponse(data: unknown): data is ApiErrorResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    'success' in data &&
    data.success === false &&
    'error' in data &&
    typeof data.error === 'object' &&
    data.error !== null &&
    'code' in data.error
  );
}

/**
 * Parse an API error and extract all relevant information
 *
 * @param error - The error object from an API call
 * @returns ParsedApiError with code, message, translation key, and details
 *
 * @example
 * ```tsx
 * try {
 *   await loginMutation({ email, password }).unwrap();
 * } catch (error) {
 *   const parsed = parseApiError(error);
 *   const message = t(parsed.translationKey);
 *   toast.error(message);
 * }
 * ```
 */
export function parseApiError(error: unknown): ParsedApiError {
  // Default error structure
  const defaultError: ParsedApiError = {
    code: ErrorCode.INTERNAL_ERROR,
    message: 'An unexpected error occurred',
    translationKey: getErrorCodeTranslationKey('UNKNOWN_ERROR'),
    isValidationError: false,
  };

  // Handle string errors
  if (typeof error === 'string') {
    return {
      ...defaultError,
      message: error,
    };
  }

  // Handle non-objects
  if (typeof error !== 'object' || error === null) {
    return defaultError;
  }

  // Handle RTK Query errors
  if (isRtkQueryError(error)) {
    const statusCode = typeof error.status === 'number' ? error.status : undefined;

    // Handle network errors
    if (error.status === 'FETCH_ERROR') {
      return {
        code: 'NETWORK_ERROR',
        message: 'Network error',
        translationKey: 'toast.error.networkError',
        statusCode: undefined,
        isValidationError: false,
      };
    }

    if (error.status === 'TIMEOUT_ERROR') {
      return {
        code: 'TIMEOUT_ERROR',
        message: 'Request timed out',
        translationKey: 'toast.error.timeoutError',
        statusCode: undefined,
        isValidationError: false,
      };
    }

    // Check for API error response in data
    if (error.data) {
      // Standard API error format: { success: false, error: { code, message } }
      if (isApiErrorResponse(error.data)) {
        const { code, message, details } = error.data.error;
        const isValidationError = code === ErrorCode.VALIDATION_ERROR;

        return {
          code,
          message,
          translationKey: getErrorCodeTranslationKey(code),
          statusCode,
          details,
          isValidationError,
          fieldErrors: isValidationError ? extractFieldErrors(details) : undefined,
        };
      }

      // Alternative format: { error: { code, message } }
      if (
        typeof error.data === 'object' &&
        'error' in error.data &&
        error.data.error &&
        typeof error.data.error === 'object' &&
        'code' in error.data.error
      ) {
        const apiError = error.data.error as ApiErrorResponse['error'];
        const isValidationError = apiError.code === ErrorCode.VALIDATION_ERROR;

        return {
          code: apiError.code,
          message: apiError.message,
          translationKey: getErrorCodeTranslationKey(apiError.code),
          statusCode,
          details: apiError.details,
          isValidationError,
          fieldErrors: isValidationError ? extractFieldErrors(apiError.details) : undefined,
        };
      }

      // Legacy format: { message: string }
      if (typeof error.data === 'object' && 'message' in error.data) {
        const message = String(error.data.message);
        return {
          ...defaultError,
          message,
          statusCode,
        };
      }
    }

    // Handle by status code
    return {
      ...defaultError,
      statusCode,
      translationKey: getStatusCodeTranslationKey(statusCode),
    };
  }

  // Handle standard Error objects
  if ('message' in error && typeof error.message === 'string') {
    return {
      ...defaultError,
      message: error.message,
    };
  }

  return defaultError;
}

/**
 * Get error code from an API error
 * Useful for conditional error handling
 *
 * @example
 * ```tsx
 * const code = getErrorCode(error);
 * if (code === ErrorCode.SESSION_EXPIRED) {
 *   router.push('/auth/login');
 * }
 * ```
 */
export function getErrorCode(error: unknown): string {
  return parseApiError(error).code;
}

/**
 * Get translated error message
 * This is a convenience function that combines parsing and translation
 *
 * @param error - The error object
 * @param t - Translation function from next-intl
 * @param fallback - Optional fallback message if translation not found
 *
 * @example
 * ```tsx
 * const message = getTranslatedError(error, t);
 * toast.error(message);
 * ```
 */
export function getTranslatedError(
  error: unknown,
  t: (key: string) => string,
  fallback?: string,
): string {
  const parsed = parseApiError(error);

  try {
    const translated = t(parsed.translationKey);
    // If translation returns the key itself, it means translation was not found
    if (translated === parsed.translationKey) {
      return fallback || parsed.message;
    }
    return translated;
  } catch {
    // Translation function threw an error (key not found)
    return fallback || parsed.message;
  }
}

/**
 * Check if error is a specific error code
 *
 * @example
 * ```tsx
 * if (isErrorCode(error, ErrorCode.INVALID_CREDENTIALS)) {
 *   // Handle invalid credentials specifically
 * }
 * ```
 */
export function isErrorCode(error: unknown, code: string): boolean {
  return getErrorCode(error) === code;
}

/**
 * Check if error is a validation error
 */
export function isValidationError(error: unknown): boolean {
  return parseApiError(error).isValidationError;
}

/**
 * Get field-specific errors from a validation error
 *
 * @example
 * ```tsx
 * const fieldErrors = getFieldErrors(error);
 * if (fieldErrors?.email) {
 *   setError('email', { message: fieldErrors.email[0] });
 * }
 * ```
 */
export function getFieldErrors(error: unknown): Record<string, string[]> | undefined {
  return parseApiError(error).fieldErrors;
}
