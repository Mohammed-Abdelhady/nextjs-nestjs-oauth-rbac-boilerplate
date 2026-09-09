/**
 * Origin of the NestJS API.
 *
 * Shared by the RTK Query base query and by the full page navigations the
 * OAuth flow needs, so both always point at the same host.
 */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
