/**
 * Origin of the NestJS API.
 *
 * Shared by the RTK Query base query and by the full page navigations the
 * OAuth flow needs, so both always point at the same host.
 */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

/**
 * Browser proof endpoints. `csrf` returns the reusable session-bound proof for
 * a signed-in browser; `browser-proof` returns a single-use pre-session proof.
 */
export const CSRF_ENDPOINT = '/api/auth/csrf';
export const BROWSER_PROOF_ENDPOINT = '/api/auth/browser-proof';
export const LOGOUT_ENDPOINT = '/api/auth/logout';
