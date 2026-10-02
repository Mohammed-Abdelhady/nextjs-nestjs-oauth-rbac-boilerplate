import { describe, expect, it } from 'vitest';
import { getFieldErrors, parseApiError } from './api-error';

describe('parseApiError', () => {
  it('surfaces the field errors of a validation failure as the server sends them', () => {
    const error = {
      status: 400,
      data: {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: { fields: { name: ['Name must be at least 2 characters'] } },
        },
      },
    };

    const parsed = parseApiError(error);

    expect(parsed.isValidationError).toBe(true);
    expect(parsed.fieldErrors).toEqual({ name: ['Name must be at least 2 characters'] });
    expect(getFieldErrors(error)).toEqual({ name: ['Name must be at least 2 characters'] });
  });

  it('reports no field errors for a code that is not a validation failure', () => {
    const parsed = parseApiError({
      status: 429,
      data: {
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests',
          details: { retryAfter: 60, fields: { name: ['ignored'] } },
        },
      },
    });

    expect(parsed.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(parsed.fieldErrors).toBeUndefined();
  });

  it.each([
    [400, 'errors.codes.INVALID_INPUT'],
    [401, 'errors.codes.SESSION_INVALID'],
    [409, 'errors.codes.CONFLICT'],
    [418, 'errors.codes.UNKNOWN_ERROR'],
  ])('keeps the status of a bodiless %i and translates it as the server would', (status, key) => {
    const parsed = parseApiError({ status, data: undefined });

    expect(parsed.statusCode).toBe(status);
    expect(parsed.translationKey).toBe(key);
    // The code stays the parser's default: callers tell a bodiless reply apart by it.
    expect(parsed.code).toBe('INTERNAL_ERROR');
  });
});
