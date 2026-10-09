import { AuthDisposedError, AuthSessionError } from '@app/native-auth';
import { ApiError, TRANSPORT_FAILURE, isTransportError } from '@app/sdk';
import { API_FAILURE } from '../constants';
import type { ApiFailure } from '../types';

/** Reduces whatever a request rejected with to a value the store can keep. */
export function toApiFailure(error: unknown): ApiFailure {
  if (isTransportError(error) && error.reason === TRANSPORT_FAILURE.NO_RESPONSE) {
    return { kind: API_FAILURE.OFFLINE };
  }
  if (error instanceof AuthSessionError || error instanceof AuthDisposedError) {
    return { kind: API_FAILURE.SIGNED_OUT };
  }
  if (error instanceof ApiError) {
    return { kind: API_FAILURE.REFUSED, code: error.code, status: error.status };
  }
  return { kind: API_FAILURE.UNKNOWN };
}

export function isApiFailure(value: unknown): value is ApiFailure {
  return typeof value === 'object' && value !== null && 'kind' in value;
}
