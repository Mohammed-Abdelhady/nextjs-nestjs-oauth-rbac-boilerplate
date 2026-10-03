import type { Response } from 'supertest';

/** Per-request headers two answers are not expected to share. */
export const VOLATILE_HEADERS = new Set([
  'date',
  'x-request-id',
  'x-ratelimit-limit',
  'x-ratelimit-remaining',
  'x-ratelimit-reset',
  'retry-after',
]);

/**
 * Compare two answers the way an address probe would: same status, same body
 * text, no cookie, and the same headers once the per-request ones are removed.
 */
export function expectSameAnswer(actual: Response, expected: Response): void {
  expect(actual.status).toBe(expected.status);
  expect(actual.text).toBe(expected.text);
  expect(actual.headers['set-cookie']).toBeUndefined();
  expect(expected.headers['set-cookie']).toBeUndefined();

  const stable = (response: Response): Record<string, string> => {
    const headers: Record<string, string> = {};
    for (const [name, value] of Object.entries(response.headers)) {
      if (!VOLATILE_HEADERS.has(name.toLowerCase())) headers[name] = value;
    }
    return headers;
  };
  expect(stable(actual)).toEqual(stable(expected));
}
