import type { OAuthProviderSummary } from '../types';

/**
 * Readable name for a provider id when the discovery response is missing,
 * for example on the callback page before the providers query resolves.
 */
export function formatProviderId(providerId: string): string {
  if (providerId.length === 0) {
    return '';
  }
  return providerId.charAt(0).toUpperCase() + providerId.slice(1);
}

/**
 * Display name the backend reports for a provider id, falling back to the id.
 */
export function getProviderDisplayName(
  providerId: string,
  providers: OAuthProviderSummary[] = [],
): string {
  return (
    providers.find((provider) => provider.id === providerId)?.displayName ??
    formatProviderId(providerId)
  );
}
