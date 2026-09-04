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
  /**
   * Remaining `OAUTH_<PROVIDER>_*` variables, keyed by the part after the
   * prefix. Providers that need more than a client id and secret read them
   * here, so this file stays free of provider specifics. Apple, for example,
   * reads TEAM_ID, KEY_ID and PRIVATE_KEY.
   */
  extra: Record<string, string>;
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

const RESERVED_SUFFIXES = ['CLIENT_ID', 'CLIENT_SECRET', 'CALLBACK_URL'];

/** Every `OAUTH_<PROVIDER>_*` variable that is not one of the three standard ones. */
function readExtraVariables(prefix: string): Record<string, string> {
  const extra: Record<string, string> = {};

  for (const [key, value] of Object.entries(process.env)) {
    if (!key.startsWith(prefix) || value === undefined || value === '') {
      continue;
    }
    const suffix = key.slice(prefix.length);
    if (!RESERVED_SUFFIXES.includes(suffix)) {
      extra[suffix] = value;
    }
  }

  return extra;
}

/**
 * Reads `OAUTH_<PROVIDER>_*` variables for every supported provider.
 * A provider is enabled as soon as it has a client id and secret. Providers
 * that authenticate differently, such as Apple, override `isEnabled()` in their
 * strategy and read what they need from `extra`.
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
      extra: readExtraVariables(prefix),
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
