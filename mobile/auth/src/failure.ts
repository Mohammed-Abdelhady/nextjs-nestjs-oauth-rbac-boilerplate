import { OAUTH_ERROR, OAuthError } from '@app/sdk';
import { DISABLED_OAUTH_DESCRIPTION } from './constants';
import type { AuthReason } from './types/auth';

export function oauthFailureReason(error: OAuthError): AuthReason {
  return isNativeAuthDisabled(error) ? 'disabled' : 'oauthFailure';
}

export function isNativeAuthDisabled(error: OAuthError): boolean {
  return (
    error.error === OAUTH_ERROR.UNAUTHORIZED_CLIENT &&
    error.errorDescription === DISABLED_OAUTH_DESCRIPTION
  );
}

export function isDefinitiveRefreshFailure(error: OAuthError): boolean {
  return (
    error.error === OAUTH_ERROR.INVALID_GRANT ||
    error.error === OAUTH_ERROR.INVALID_CLIENT ||
    isNativeAuthDisabled(error)
  );
}
