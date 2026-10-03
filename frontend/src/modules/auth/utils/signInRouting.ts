import {
  ADMIN_PERMISSIONS,
  ADMIN_SIGNED_IN_PATH,
  DEFAULT_SIGNED_IN_PATH,
  REDIRECT_PARAM,
  TWO_FACTOR_PATH,
} from '../constants/authMethods';
import type { SignedInUser } from '../types/auth.types';
import { getRedirectPath } from './authHelpers';

/** Where an account lands when the sign-in carried no redirect of its own. */
export function defaultPathFor(user: SignedInUser | null): string {
  const permissions = user?.permissions ?? [];
  const isAdmin = ADMIN_PERMISSIONS.some((permission) => permissions.includes(permission));
  return isAdmin ? ADMIN_SIGNED_IN_PATH : DEFAULT_SIGNED_IN_PATH;
}

/** The page to open once a sign-in finishes, rejecting off-site redirects. */
export function signedInPath(user: SignedInUser | null, redirect?: string | null): string {
  return getRedirectPath(redirect, defaultPathFor(user));
}

/**
 * The challenge page, with the requested page carried across so the second
 * factor does not lose it.
 */
export function twoFactorPath(redirect?: string | null): string {
  if (!redirect) {
    return TWO_FACTOR_PATH;
  }
  return `${TWO_FACTOR_PATH}?${REDIRECT_PARAM}=${encodeURIComponent(redirect)}`;
}

/** Carries only a validated internal continuation between auth screens. */
export function authPagePath(path: string, redirect?: string | null): string {
  const continuation = getRedirectPath(redirect, '');
  return continuation ? `${path}?${REDIRECT_PARAM}=${encodeURIComponent(continuation)}` : path;
}
