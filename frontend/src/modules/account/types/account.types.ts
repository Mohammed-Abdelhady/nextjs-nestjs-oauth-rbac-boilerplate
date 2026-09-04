import type { OAuthProvider } from '@/modules/oauth';

/**
 * Response type for linked providers endpoint.
 * Providers are 'email' plus the linked OAuth provider ids.
 */
export interface LinkedProvidersResponse {
  providers: string[];
  primaryProvider?: string;
}

/**
 * Request type for setting primary provider
 */
export interface SetPrimaryProviderRequest {
  provider: OAuthProvider;
}

/**
 * Profile Sync Status Response
 */
export interface ProfileSyncStatus {
  lastSyncedAt?: string;
  lastSyncedProvider?: string;
  primaryProvider?: OAuthProvider;
  canSync: boolean;
}

/**
 * Manual Sync Response
 */
export interface ManualSyncResponse {
  requiresOAuth: boolean;
  provider: OAuthProvider;
  message: string;
}

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
