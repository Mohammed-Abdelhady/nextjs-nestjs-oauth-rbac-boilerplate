import { afterEach, describe, expect, it, vi } from 'vitest';
import { isValidElement } from 'react';
import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { errorInterceptor } from './errorInterceptor';
import { toast } from '@/lib/toast';
import { ErrorCode } from '@app/core';

vi.mock('@/lib/toast', () => ({ toast: { show: vi.fn() } }));

function reject(payload: FetchBaseQueryError) {
  const action = {
    type: 'api/executeQuery/rejected',
    payload,
    meta: {
      requestId: 'fixture',
      requestStatus: 'rejected',
      rejectedWithValue: true,
      arg: { endpointName: 'getCurrentUser' },
    },
  };
  const next = vi.fn();
  errorInterceptor({ dispatch: vi.fn(), getState: () => ({}) })(next)(action);
  expect(next).toHaveBeenCalledWith(action);
}

afterEach(() => vi.clearAllMocks());

describe('error toast middleware contract', () => {
  it.each([
    [409, ErrorCode.SESSION_LIMIT_REACHED],
    [503, ErrorCode.AUTHORITY_UNAVAILABLE],
  ])('uses the catalog key for a recognized %i response', (status, code) => {
    reject({
      status,
      data: { success: false, error: { code, message: 'Backend message' } },
    });

    const message = vi.mocked(toast.show).mock.calls[0][1];
    expect(isValidElement<{ messageKey: string }>(message)).toBe(true);
    if (!isValidElement<{ messageKey: string }>(message)) {
      throw new Error('Expected a localized toast message');
    }
    expect(message.props.messageKey).toBe(`errors.codes.${code}`);
  });

  it('renders generated keys through the locale-aware component without endpoint prose', () => {
    reject({ status: 'FETCH_ERROR', error: 'Network failure' });
    expect(toast.show).toHaveBeenCalledWith('error', expect.anything(), { duration: 10000 });
    expect(isValidElement(vi.mocked(toast.show).mock.calls[0][1])).toBe(true);
  });

  it.each([
    { message: 'Literal backend message' },
    { error: { code: 'FIXTURE', message: 'toast.error.networkError' } },
    { error: 'Literal backend error' },
  ])('preserves backend-provided messages verbatim: %j', (data) => {
    reject({ status: 400, data });
    const expected =
      'message' in data
        ? data.message
        : typeof data.error === 'string'
          ? data.error
          : data.error.message;
    expect(vi.mocked(toast.show).mock.calls[0][1]).toBe(expected);
  });

  it('keeps anonymous 401 silent', () => {
    reject({ status: 401, data: {} });
    expect(toast.show).not.toHaveBeenCalled();
  });
});
