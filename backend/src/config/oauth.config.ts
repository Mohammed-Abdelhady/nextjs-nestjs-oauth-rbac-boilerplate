import {
  SUPPORTED_OAUTH_PROVIDERS,
  SupportedOAuthProvider,
} from '../common/constants/oauth-providers';

export interface OAuthProviderConfig {
  enabled: boolean;
  clientId?: string;
  clientSecret?: string;
  callbackUrl?: string;
}

export type OAuthConfigMap = Record<
  SupportedOAuthProvider,
  OAuthProviderConfig
>;

export function createOAuthConfig(): OAuthConfigMap {
  const entries: [SupportedOAuthProvider, OAuthProviderConfig][] =
    SUPPORTED_OAUTH_PROVIDERS.map((provider) => {
      const prefix = `OAUTH_${provider.toUpperCase()}_`;
      const clientId = process.env[`${prefix}CLIENT_ID`];
      const clientSecret = process.env[`${prefix}CLIENT_SECRET`];
      const callbackUrl = process.env[`${prefix}CALLBACK_URL`];

      const config: OAuthProviderConfig = {
        enabled: Boolean(clientId && clientSecret && callbackUrl),
        clientId,
        clientSecret,
        callbackUrl,
      };

      return [provider, config];
    });

  const oauthConfig: Partial<OAuthConfigMap> = {};
  for (const [provider, config] of entries) {
    oauthConfig[provider] = config;
  }

  return oauthConfig as OAuthConfigMap;
}
