import { OAUTH_ERROR, OAuthError } from '@app/sdk';
import { DISABLED_OAUTH_DESCRIPTION, NATIVE_DPOP_REQUIRED_REASON } from '../constants';
import type { AuthReason } from '../types/auth';

export function oauthFailureReason(error: OAuthError): AuthReason {
  return isNativeAuthDisabled(error) ? 'disabled' : 'oauthFailure';
}

export function isNativeAuthDisabled(error: OAuthError): boolean {
  return (
    error.error === OAUTH_ERROR.UNAUTHORIZED_CLIENT &&
    error.errorDescription === DISABLED_OAUTH_DESCRIPTION
  );
}

export function isDeviceBindingRequired(error: OAuthError): boolean {
  return (
    error.error === OAUTH_ERROR.INVALID_DPOP_PROOF &&
    error.errorDescription === NATIVE_DPOP_REQUIRED_REASON
  );
}

export function isDefinitiveRefreshFailure(error: OAuthError): boolean {
  return (
    error.error === OAUTH_ERROR.INVALID_GRANT ||
    error.error === OAUTH_ERROR.INVALID_CLIENT ||
    isNativeAuthDisabled(error)
  );
}
