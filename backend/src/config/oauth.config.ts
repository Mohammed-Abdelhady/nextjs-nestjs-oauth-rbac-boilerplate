import {
  GENERIC_OIDC_PROVIDER,
  SUPPORTED_OAUTH_PROVIDERS,
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

/**
 * Keyed by provider id. Every entry of SUPPORTED_OAUTH_PROVIDERS is present;
 * the generic OIDC provider adds one more under the id it was given.
 */
export type OAuthProvidersConfig = Record<string, OAuthProviderConfig>;

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
  const providers: OAuthProvidersConfig = {};

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

  aliasGenericOidcProvider(providers);
  return providers;
}

/**
 * The generic OIDC provider is routed under OAUTH_OIDC_PROVIDER_ID rather than
 * under `oidc`, so its configuration has to be reachable under that id too.
 * Everything else looks providers up by the id the strategy reports.
 */
function aliasGenericOidcProvider(providers: OAuthProvidersConfig): void {
  const slug = providers[GENERIC_OIDC_PROVIDER]?.extra.PROVIDER_ID;
  // An id that is already taken is left alone here. The generic strategy
  // refuses to construct on the same id, which reports it rather than hiding
  // the built-in provider behind it.
  if (!slug || slug === GENERIC_OIDC_PROVIDER || providers[slug]) {
    return;
  }

  providers[slug] = providers[GENERIC_OIDC_PROVIDER];
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
