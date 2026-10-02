import { afterEach, describe, expect, it, vi } from 'vitest';
import { isValidElement } from 'react';
import { toast } from '@/lib/toast';
import { reportUnlessHandled } from '../requestFailure';

vi.mock('@/lib/toast', () => ({ toast: { error: vi.fn() } }));

function thrownBy(run: () => void): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }
  return undefined;
}

afterEach(() => vi.clearAllMocks());

describe('reportUnlessHandled', () => {
  it.each([
    ['a 401 answer', { status: 401, data: { success: false, error: { code: 'SESSION_INVALID' } } }],
    ['a validation answer', { status: 400, data: {} }],
    ['a network failure', { status: 'FETCH_ERROR', error: 'TypeError: Failed to fetch' }],
    [
      'a reply the client could not read',
      { name: 'ApiError', message: 'The response is malformed' },
    ],
    ['a cancelled request', { name: 'AbortError', message: 'Aborted' }],
  ])('stays quiet for %s and does not rethrow it', (_label, rejection) => {
    expect(thrownBy(() => reportUnlessHandled(rejection))).toBeUndefined();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it.each([
    ['a programming error', new TypeError('redirect is not a function')],
    ['a thrown string', 'boom'],
    ['a thrown nothing', undefined],
  ])('shows the generic message and passes on %s', (_label, error) => {
    let caught: unknown = 'nothing was thrown';
    try {
      reportUnlessHandled(error);
    } catch (thrown) {
      caught = thrown;
    }
    expect(caught).toBe(error);

    expect(toast.error).toHaveBeenCalledTimes(1);
    const message = vi.mocked(toast.error).mock.calls[0]?.[0];
    if (!isValidElement<{ messageKey: string }>(message)) {
      throw new Error('Expected a localized toast message');
    }
    expect(message.props.messageKey).toBe('toast.error.unknownError');
  });
});
