import {
  SUPPORTED_OAUTH_PROVIDERS,
  SupportedOAuthProvider,
} from '../common/constants/oauth-providers';

export interface OAuthProviderConfig {
  enabled: boolean;
  clientId?: string;
  clientSecret?: string;
  /** Optional override of the callback URL derived from OAUTH_CALLBACK_BASE_URL. */
  callbackUrl?: string;
}

export type OAuthProvidersConfig = Record<
  SupportedOAuthProvider,
  OAuthProviderConfig
>;

export interface OAuthConfig {
  /** HMAC key for the signed state cookie. */
  stateSecret?: string;
  /** Base URL the providers redirect back to, without the provider segment. */
  callbackBaseUrl: string;
  providers: OAuthProvidersConfig;
}

/**
 * Reads `OAUTH_<PROVIDER>_*` variables for every supported provider.
 * A provider is enabled as soon as it has a client id and secret.
 */
export function createOAuthProvidersConfig(): OAuthProvidersConfig {
  const providers: Partial<OAuthProvidersConfig> = {};

  for (const provider of SUPPORTED_OAUTH_PROVIDERS) {
    const prefix = `OAUTH_${provider.toUpperCase()}_`;
    const clientId = process.env[`${prefix}CLIENT_ID`];
    const clientSecret = process.env[`${prefix}CLIENT_SECRET`];

    providers[provider] = {
      enabled: Boolean(clientId && clientSecret),
      clientId,
      clientSecret,
      callbackUrl: process.env[`${prefix}CALLBACK_URL`],
    };
  }

  return providers as OAuthProvidersConfig;
}

export function createOAuthConfig(apiUrl: string): OAuthConfig {
  return {
    stateSecret: process.env.OAUTH_STATE_SECRET,
    callbackBaseUrl:
      process.env.OAUTH_CALLBACK_BASE_URL ||
      `${apiUrl.replace(/\/$/, '')}/api/auth/oauth`,
    providers: createOAuthProvidersConfig(),
  };
}
