import { parseApiError } from '../../../lib/apiError';

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

/**
 * Checks if a JWT token is expired
 * Decodes the token payload and checks the expiration timestamp
 *
 * @param token - JWT token string
 * @returns True if token is expired, false if still valid, null if invalid token
 *
 * @example
 * isTokenExpired('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...') // false
 */
export function isTokenExpired(token: string): boolean | null {
  if (!token) return null;

  try {
    // JWT tokens have 3 parts: header.payload.signature
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    // Decode the payload (second part)
    const payload = JSON.parse(atob(parts[1]));

    // Check if exp claim exists
    if (!payload.exp) return null;

    // exp is in seconds, Date.now() is in milliseconds
    const expirationTime = payload.exp * 1000;
    const currentTime = Date.now();

    return currentTime > expirationTime;
  } catch {
    // Invalid token format
    return null;
  }
}

const DEFAULT_REDIRECT_PATH = '/dashboard';

const AUTH_PAGES = [
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/activate',
];

/**
 * Determines the redirect path after authentication
 * Accepts only same-origin relative paths
 *
 * @param pathname - Current pathname or redirect query parameter
 * @param defaultPath - Fallback path when candidate is rejected (defaults to /dashboard)
 * @returns Safe relative path to redirect to
 *
 * @example
 * getRedirectPath('/dashboard') // '/dashboard'
 * getRedirectPath('https://evil.com') // '/dashboard'
 * getRedirectPath('/auth/login') // '/dashboard'
 */
export function getRedirectPath(
  pathname?: string | null,
  defaultPath: string = DEFAULT_REDIRECT_PATH,
): string {
  if (!pathname || typeof pathname !== 'string') {
    return defaultPath;
  }

  // Must start with a single '/' and not '//' or '/\'
  if (!pathname.startsWith('/') || pathname.startsWith('//') || pathname.startsWith('/\\')) {
    return defaultPath;
  }

  // Must not contain a scheme
  const hasScheme =
    /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(pathname) ||
    pathname.includes('://') ||
    pathname.toLowerCase().includes('javascript:') ||
    pathname.toLowerCase().includes('data:');
  if (hasScheme) {
    return defaultPath;
  }

  // Must not be an auth page
  const cleanPath = pathname.split('?')[0].split('#')[0];
  const isAuthPage =
    cleanPath === '/auth' ||
    cleanPath.startsWith('/auth/') ||
    AUTH_PAGES.some((page) => cleanPath === page || cleanPath.startsWith(`${page}/`));
  if (isAuthPage) {
    return defaultPath;
  }

  return pathname;
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
