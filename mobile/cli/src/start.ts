import { AUTH_CONFIGURATION, EPHEMERAL_BROWSER_SESSION } from './config';
import { createNativeShellAuth } from './engine';

/**
 * Built once per process. It lives apart from the screens so that editing one
 * in development does not build a second engine, which would spend the same
 * refresh token twice.
 */
export const AUTH = createNativeShellAuth(AUTH_CONFIGURATION, EPHEMERAL_BROWSER_SESSION);
