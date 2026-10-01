import { parseApiError } from '../../../lib/apiError';
import { routing } from '@/i18n/routing';
import { NATIVE_AUTHORIZE_PATH, NATIVE_TRANSACTION_PARAM } from '../constants/nativeAuthorize';

/**
 * Validates if a string is a valid email format
 * Uses RFC 5322 standard email regex
 *
 * @param email - Email string to validate
 * @returns True if valid email format, false otherwise
 *
 * @example
 * isValidEmail('user@example.com') // true
 * isValidEmail('invalid-email') // false
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

const DEFAULT_REDIRECT_PATH = '/dashboard';

const AUTH_PAGES = [
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/activate',
];

const SUPPORTED_LOCALES: readonly string[] = routing.locales;

/** C0 controls and DEL can hide a scheme from a naive reader. */
const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/;

/** True when a supported-locale prefix still leads the path. */
function hasLocalePrefix(pathname: string): boolean {
  for (const locale of SUPPORTED_LOCALES) {
    const prefix = `/${locale}`;
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return true;
    }
  }
  return false;
}

/**
 * Removes exactly one supported-locale prefix so the same route compares equal
 * whether it was captured on `/en/...` or `/ar/...`. Only a whole first segment
 * counts: `/english` keeps its name. A second locale prefix is left in place
 * for the caller to reject.
 */
function stripLocalePrefix(pathname: string): string {
  for (const locale of SUPPORTED_LOCALES) {
    const prefix = `/${locale}`;
    if (pathname.startsWith(`${prefix}/`)) {
      return pathname.slice(prefix.length);
    }
    if (pathname === prefix) {
      return '/';
    }
  }
  return pathname;
}

/**
 * The one auth route a redirect may name: the native authorize page with
 * exactly the `transaction` query and nothing else.
 */
function isNativeAuthorizeRoute(pathname: string): boolean {
  if (pathname.includes('#')) {
    return false;
  }
  const separator = pathname.indexOf('?');
  const path = separator === -1 ? pathname : pathname.slice(0, separator);
  if (path !== NATIVE_AUTHORIZE_PATH) {
    return false;
  }
  const query = separator === -1 ? '' : pathname.slice(separator + 1);
  const params = new URLSearchParams(query);
  const keys = [...params.keys()];
  // A repeated key yields the key more than once, so this also rejects it.
  if (keys.length !== 1 || keys[0] !== NATIVE_TRANSACTION_PARAM) {
    return false;
  }
  return (params.get(NATIVE_TRANSACTION_PARAM) ?? '').length > 0;
}

/**
 * Determines the redirect path after authentication
 * Accepts only same-origin relative paths
 *
 * The native authorize route is the single auth page that may be carried
 * through a sign-in, so the browser can come back and finish the request. It is
 * accepted only with a transaction id; every other auth path is still rejected.
 *
 * @param pathname - Current pathname or redirect query parameter
 * @param defaultPath - Fallback path when candidate is rejected (defaults to /dashboard)
 * @returns Safe relative path to redirect to
 *
 * @example
 * getRedirectPath('/dashboard') // '/dashboard'
 * getRedirectPath('https://evil.com') // '/dashboard'
 * getRedirectPath('/auth/login') // '/dashboard'
 * getRedirectPath('/ar/auth/native/authorize?transaction=abc')
 *   // '/auth/native/authorize?transaction=abc'
 */
export function getRedirectPath(
  pathname?: string | null,
  defaultPath: string = DEFAULT_REDIRECT_PATH,
): string {
  if (!pathname || typeof pathname !== 'string') {
    return defaultPath;
  }

  if (!pathname.startsWith('/')) {
    return defaultPath;
  }

  if (CONTROL_CHARACTERS.test(pathname)) {
    return defaultPath;
  }

  const normalized = stripLocalePrefix(pathname);

  // Exactly one supported-locale prefix: a second one is a different route.
  if (hasLocalePrefix(normalized)) {
    return defaultPath;
  }

  // Must start with a single '/' and not '//' or '/\'
  if (normalized.startsWith('//') || normalized.startsWith('/\\')) {
    return defaultPath;
  }

  // A backslash anywhere is normalised to a slash by browsers, so it never
  // names the route it appears to.
  if (normalized.includes('\\')) {
    return defaultPath;
  }

  const pathPart = normalized.split(/[?#]/, 1)[0];
  // `//` in the path and `..` segments both let a URL parser reach another host.
  if (pathPart.includes('//')) {
    return defaultPath;
  }
  if (pathPart.split('/').includes('..')) {
    return defaultPath;
  }

  // Must not contain a scheme
  const hasScheme =
    /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(normalized) ||
    normalized.includes('://') ||
    normalized.toLowerCase().includes('javascript:') ||
    normalized.toLowerCase().includes('data:');
  if (hasScheme) {
    return defaultPath;
  }

  // The native authorize route is the only auth page allowed through.
  if (isNativeAuthorizeRoute(normalized)) {
    return normalized;
  }

  // Must not be an auth page
  const cleanPath = normalized.split('?')[0].split('#')[0];
  const isAuthPage =
    cleanPath === '/auth' ||
    cleanPath.startsWith('/auth/') ||
    AUTH_PAGES.some((page) => cleanPath === page || cleanPath.startsWith(`${page}/`));
  if (isAuthPage) {
    return defaultPath;
  }

  return normalized;
}

/**
 * Extracts error message from various error formats
 * Handles API errors, Error objects, and strings
 *
 * @param error - Error object, string, or API error response
 * @returns User-friendly error message
 *
 * @example
 * getErrorMessage(new Error('Network error')) // 'Network error'
 * getErrorMessage({ message: 'Invalid credentials' }) // 'Invalid credentials'
 * getErrorMessage('Something went wrong') // 'Something went wrong'
 *
 * @deprecated Use parseApiError from '@/lib/apiError' for better error handling with i18n support
 */
export function getErrorMessage(error: unknown): string {
  return parseApiError(error).message;
}

/**
 * Maps API error messages to translation keys
 * Provides translation key for common error scenarios
 *
 * @param error - Error object from API
 * @param t - Translation function from next-intl
 * @returns Translated error message
 *
 * @example
 * translateAuthError(apiError, t) // 'Invalid email or password'
 */
export function translateAuthError(error: unknown, t: (key: string) => string): string {
  const rawMessage = getErrorMessage(error).toLowerCase();

  // Map common error messages to translation keys
  const errorMap: Record<string, string> = {
    'invalid credentials': 'errors.invalidCredentials',
    'invalid email or password': 'errors.invalidCredentials',
    'user not found': 'errors.invalidCredentials',
    'incorrect password': 'errors.invalidCredentials',
    'network error': 'errors.networkError',
    'failed to fetch': 'errors.networkError',
    'too many attempts': 'errors.tooManyAttempts',
    'too many requests': 'errors.tooManyAttempts',
    'rate limit exceeded': 'errors.tooManyAttempts',
  };

  // Check if error message matches any known pattern
  for (const [pattern, key] of Object.entries(errorMap)) {
    if (rawMessage.includes(pattern)) {
      return t(key);
    }
  }

  // Check for HTTP status codes in error object
  if (error && typeof error === 'object') {
    if ('status' in error) {
      const status = Number(error.status);
      if (status === 401 || status === 403) {
        return t('errors.invalidCredentials');
      }
      if (status === 429) {
        return t('errors.tooManyAttempts');
      }
      if (status >= 500) {
        return t('errors.serverError');
      }
    }
  }

  // Default to server error translation
  return t('errors.serverError');
}
