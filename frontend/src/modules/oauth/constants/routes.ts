import { ErrorCode } from '@/constants/errorCodes';

/** Backend route prefix for the browser facing OAuth endpoints. */
export const OAUTH_ROUTE_BASE = '/api/auth/oauth';

/** Discovery endpoint listing the providers that have credentials configured. */
export const OAUTH_PROVIDERS_PATH = `${OAUTH_ROUTE_BASE}/providers`;

/** Shown when the callback URL carries no code, or one with no message. */
export const OAUTH_DEFAULT_ERROR_CODE: string = ErrorCode.OAUTH_AUTHENTICATION_FAILED;
