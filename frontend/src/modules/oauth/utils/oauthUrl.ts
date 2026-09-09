import { API_BASE_URL } from '@/constants/api';
import { getRedirectPath } from '@/modules/auth/utils';
import { OAUTH_ROUTE_BASE } from '../constants';

/**
 * URL of the server side start route for a provider.
 *
 * The route sets a signed state cookie and answers with a 302, so the browser
 * has to reach it through a full page load, not through fetch.
 *
 * @param providerId - Provider id from the discovery endpoint
 * @param redirect - Relative path to return to after sign-in
 */
export function buildOAuthStartUrl(
  providerId: string,
  redirect: string,
  intent: 'login' | 'link' = 'login',
): string {
  const url = new URL(`${OAUTH_ROUTE_BASE}/${encodeURIComponent(providerId)}/start`, API_BASE_URL);
  url.searchParams.set('redirect', redirect);
  if (intent === 'link') {
    url.searchParams.set('intent', 'link');
  }
  return url.toString();
}

/**
 * Where a sign-in started on the current page should land.
 * Reads the `redirect` query parameter and rejects anything unsafe.
 */
export function currentRedirectPath(): string {
  return getRedirectPath(new URLSearchParams(window.location.search).get('redirect'));
}

/**
 * Sends the browser to the provider through the backend start route.
 */
export function startOAuthFlow(
  providerId: string,
  redirect: string,
  intent: 'login' | 'link' = 'login',
): void {
  window.location.assign(buildOAuthStartUrl(providerId, redirect, intent));
}
