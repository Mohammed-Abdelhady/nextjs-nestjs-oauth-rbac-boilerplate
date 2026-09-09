import type { OAuthProvider } from '@/modules/oauth'; // feature:oauth-core

// feature:oauth-core:start
/**
 * Response type for linked providers endpoint.
 * Providers are 'email' plus the linked OAuth provider ids.
 */
export interface LinkedProvidersResponse {
  providers: string[];
  primaryProvider?: string;
}
// feature:oauth-core:end

// feature:oauth-core:start
/**
 * Request type for setting primary provider
 */
export interface SetPrimaryProviderRequest {
  provider: OAuthProvider;
}
// feature:oauth-core:end

// feature:oauth-core:start
/**
 * Profile Sync Status Response
 */
export interface ProfileSyncStatus {
  lastSyncedAt?: string;
  lastSyncedProvider?: string;
  primaryProvider?: OAuthProvider;
  canSync: boolean;
}
// feature:oauth-core:end

// feature:oauth-core:start
/**
 * Manual Sync Response
 */
export interface ManualSyncResponse {
  requiresOAuth: boolean;
  provider: OAuthProvider;
  message: string;
}
// feature:oauth-core:end

/**
 * User for account operations
 */
export interface AccountUser {
  id: string;
  email: string;
  name: string;
  role: string;
  permissions: string[];
}
