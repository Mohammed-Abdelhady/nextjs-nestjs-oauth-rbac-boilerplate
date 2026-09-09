import {
  GENERIC_OIDC_PROVIDER,
  SUPPORTED_OAUTH_PROVIDERS,
} from '../../../common/constants/oauth-providers';
import { OAuthProviderConfig } from '../../../config/oauth.config';
import { OidcEndpointOverrides } from './oidc-discovery.util';

/**
 * Reads the OAUTH_OIDC_* variables the generic provider is built from. Kept
 * apart from the strategy so the flow there is only OAuth.
 */

const DEFAULT_DISPLAY_NAME = 'Single sign-on';
const DEFAULT_SCOPES = 'openid profile email';
const PROVIDER_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,31}$/;

export interface OidcSettings {
  /** Route segment and the value stored on linkedAccounts. */
  providerId: string;
  displayName: string;
  /** Undefined leaves the provider disabled: there is nothing to trust. */
  issuer?: string;
  scopes: string;
  overrides: OidcEndpointOverrides;
  hasCredentials: boolean;
}

/**
 * @throws Error when OAUTH_OIDC_PROVIDER_ID would shadow a built-in provider or
 * does not fit in a route segment. Both are misconfigurations, so they stop the
 * boot rather than degrade.
 */
export function readOidcSettings(
  config: OAuthProviderConfig | undefined,
): OidcSettings {
  const extra = config?.extra ?? {};

  return {
    providerId: readProviderId(extra.PROVIDER_ID),
    displayName: extra.DISPLAY_NAME ?? DEFAULT_DISPLAY_NAME,
    issuer: extra.ISSUER,
    scopes: extra.SCOPES ?? DEFAULT_SCOPES,
    overrides: {
      authorizationUrl: extra.AUTHORIZATION_URL,
      tokenUrl: extra.TOKEN_URL,
      userInfoUrl: extra.USERINFO_URL,
      jwksUri: extra.JWKS_URL,
    },
    hasCredentials: Boolean(config?.clientId && config.clientSecret),
  };
}

function readProviderId(slug: string | undefined): string {
  if (!slug) {
    return GENERIC_OIDC_PROVIDER;
  }

  if (!PROVIDER_ID_PATTERN.test(slug)) {
    throw new Error(
      `OAUTH_OIDC_PROVIDER_ID '${slug}' has to be lowercase letters, digits and dashes`,
    );
  }

  const builtIn: readonly string[] = SUPPORTED_OAUTH_PROVIDERS;
  if (slug !== GENERIC_OIDC_PROVIDER && builtIn.includes(slug)) {
    throw new Error(
      `OAUTH_OIDC_PROVIDER_ID '${slug}' is the id of a built-in provider`,
    );
  }

  return slug;
}
