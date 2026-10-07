import { ApiError, OAuthError, TransportError, TRANSPORT_FAILURE } from '@app/sdk';
import { AuthPortError, DeviceKeyAuthError } from './errors';
import { isDeviceBindingRequired, oauthFailureReason } from './failure';
import type { SignInOutcome } from './types/auth';

export function exchangeFailureOutcome(error: unknown): SignInOutcome {
  if (error instanceof OAuthError) {
    if (isDeviceBindingRequired(error)) return { kind: 'deviceBindingRequired' };
    return oauthFailureReason(error) === 'disabled'
      ? { kind: 'disabled' }
      : { kind: 'oauthFailure', error };
  }
  if (error instanceof DeviceKeyAuthError)
    return { kind: 'deviceKeyFailure', reason: error.reason };
  if (error instanceof AuthPortError) {
    return error.operation.startsWith('crypto.')
      ? { kind: 'cryptoFailure', error }
      : {
          kind: 'apiFailure',
          error: new ApiError({ status: 0, code: 'AUTH_FAILURE', message: error.message }),
        };
  }
  if (error instanceof ApiError)
    return error.status === 429 ? { kind: 'throttled', error } : { kind: 'apiFailure', error };
  if (error instanceof TransportError) {
    return error.reason === TRANSPORT_FAILURE.ABORTED
      ? { kind: 'aborted', error }
      : { kind: 'transportFailure', error };
  }
  return {
    kind: 'apiFailure',
    error: new ApiError({ status: 0, code: 'AUTH_FAILURE', message: asError(error).message }),
  };
}

export function apiFailureOutcome(error: unknown): SignInOutcome {
  if (error instanceof ApiError)
    return error.status === 429 ? { kind: 'throttled', error } : { kind: 'apiFailure', error };
  if (error instanceof OAuthError) return { kind: 'oauthFailure', error };
  if (error instanceof TransportError) {
    return error.reason === TRANSPORT_FAILURE.ABORTED
      ? { kind: 'aborted', error }
      : { kind: 'transportFailure', error };
  }
  return {
    kind: 'apiFailure',
    error: new ApiError({ status: 0, code: 'PROFILE_FAILURE', message: asError(error).message }),
  };
}

export function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
