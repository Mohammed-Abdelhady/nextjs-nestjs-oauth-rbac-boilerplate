import { ConfigService } from '@nestjs/config';
import { OAuthRegistryService } from './oauth-registry.service';
import { OAuthProviderStrategy } from './oauth-provider.interface';
import { GoogleOAuthStrategy } from './strategies/google-oauth.strategy';
import { GitHubOAuthStrategy } from './strategies/github-oauth.strategy';
import { FacebookOAuthStrategy } from './strategies/facebook-oauth.strategy';
import { MicrosoftOAuthStrategy } from './strategies/microsoft-oauth.strategy';
import { AppleOAuthStrategy } from './strategies/apple-oauth.strategy';
import { DiscordOAuthStrategy } from './strategies/discord-oauth.strategy';
import { LinkedInOAuthStrategy } from './strategies/linkedin-oauth.strategy';
import { GitLabOAuthStrategy } from './strategies/gitlab-oauth.strategy';
import { XOAuthStrategy } from './strategies/x-oauth.strategy';
import { SlackOAuthStrategy } from './strategies/slack-oauth.strategy';
import { TwitchOAuthStrategy } from './strategies/twitch-oauth.strategy';
import { OidcOAuthStrategy } from './strategies/oidc-oauth.strategy';
import { createOAuthConfig } from '../../config/oauth.config';

/**
 * Every registered provider, built from environment variables the way the
 * running application builds them. This covers the part of the boot check that
 * does not need a database: the config reader, each strategy and the registry
 * agreeing on the same provider ids.
 */

const CALLBACK_BASE_URL = 'https://api.example.com/api/auth/oauth';
const OIDC_ISSUER = 'https://sso.example.com';

/**
 * The generic provider reads its endpoints from the issuer's discovery
 * document at startup. Spelling all four out keeps this spec off the network.
 */
const OIDC_ENDPOINTS: Record<string, string> = {
  OAUTH_OIDC_ISSUER: OIDC_ISSUER,
  OAUTH_OIDC_AUTHORIZATION_URL: `${OIDC_ISSUER}/authorize`,
  OAUTH_OIDC_TOKEN_URL: `${OIDC_ISSUER}/token`,
  OAUTH_OIDC_USERINFO_URL: `${OIDC_ISSUER}/userinfo`,
  OAUTH_OIDC_JWKS_URL: `${OIDC_ISSUER}/jwks`,
};

const PROVIDER_ENV: Record<string, string> = {
  OAUTH_GOOGLE_CLIENT_ID: 'google-id',
  OAUTH_GOOGLE_CLIENT_SECRET: 'google-secret',
  OAUTH_GITHUB_CLIENT_ID: 'github-id',
  OAUTH_GITHUB_CLIENT_SECRET: 'github-secret',
  OAUTH_FACEBOOK_CLIENT_ID: 'facebook-id',
  OAUTH_FACEBOOK_CLIENT_SECRET: 'facebook-secret',
  OAUTH_MICROSOFT_CLIENT_ID: 'microsoft-id',
  OAUTH_MICROSOFT_CLIENT_SECRET: 'microsoft-secret',
  OAUTH_MICROSOFT_TENANT: 'common',
  OAUTH_APPLE_CLIENT_ID: 'com.example.web',
  OAUTH_APPLE_TEAM_ID: 'ABCDE12345',
  OAUTH_APPLE_KEY_ID: 'KEY1234567',
  OAUTH_APPLE_PRIVATE_KEY:
    '-----BEGIN PRIVATE KEY-----\\nMIGT\\n-----END PRIVATE KEY-----',
  OAUTH_DISCORD_CLIENT_ID: 'discord-id',
  OAUTH_DISCORD_CLIENT_SECRET: 'discord-secret',
  OAUTH_LINKEDIN_CLIENT_ID: 'linkedin-id',
  OAUTH_LINKEDIN_CLIENT_SECRET: 'linkedin-secret',
  OAUTH_GITLAB_CLIENT_ID: 'gitlab-id',
  OAUTH_GITLAB_CLIENT_SECRET: 'gitlab-secret',
  OAUTH_X_CLIENT_ID: 'x-id',
  OAUTH_X_CLIENT_SECRET: 'x-secret',
  OAUTH_SLACK_CLIENT_ID: 'slack-id',
  OAUTH_SLACK_CLIENT_SECRET: 'slack-secret',
  OAUTH_TWITCH_CLIENT_ID: 'twitch-id',
  OAUTH_TWITCH_CLIENT_SECRET: 'twitch-secret',
  OAUTH_OIDC_CLIENT_ID: 'oidc-id',
  OAUTH_OIDC_CLIENT_SECRET: 'oidc-secret',
  ...OIDC_ENDPOINTS,
};

function configServiceFromEnv(env: Record<string, string>): ConfigService {
  const previous = process.env;
  // Start from an env without OAuth variables, so a loaded .env cannot leak in.
  process.env = Object.fromEntries(
    Object.entries(previous).filter(([key]) => !key.startsWith('OAUTH_')),
  );
  Object.assign(process.env, env);
  const oauth = createOAuthConfig('https://api.example.com');
  process.env = previous;

  const values: Record<string, unknown> = {
    'oauth.callbackBaseUrl': oauth.callbackBaseUrl,
  };
  for (const [id, provider] of Object.entries(oauth.providers)) {
    values[`oauth.providers.${id}`] = provider;
  }

  return {
    get: <T>(key: string, fallback?: T): T | undefined =>
      (values[key] as T | undefined) ?? fallback,
  } as unknown as ConfigService;
}

function registryFor(env: Record<string, string>): OAuthRegistryService {
  const configService = configServiceFromEnv(env);
  const strategies: OAuthProviderStrategy[] = [
    new GoogleOAuthStrategy(configService),
    new GitHubOAuthStrategy(configService),
    new FacebookOAuthStrategy(configService),
    new MicrosoftOAuthStrategy(configService),
    new AppleOAuthStrategy(configService),
    new DiscordOAuthStrategy(configService),
    new LinkedInOAuthStrategy(configService),
    new GitLabOAuthStrategy(configService),
    new XOAuthStrategy(configService),
    new SlackOAuthStrategy(configService),
    new TwitchOAuthStrategy(configService),
    new OidcOAuthStrategy(configService),
  ];

  return new OAuthRegistryService(strategies, configService);
}

describe('OAuth provider wiring', () => {
  it('registers every provider the application lists', () => {
    expect(registryFor(PROVIDER_ENV).getIds()).toEqual([
      'google',
      'github',
      'facebook',
      'microsoft',
      'apple',
      'discord',
      'linkedin',
      'gitlab',
      'x',
      'slack',
      'twitch',
      'oidc',
    ]);
  });

  it('enables each provider from its own variables', () => {
    expect(registryFor(PROVIDER_ENV).listEnabled()).toEqual([
      { id: 'google', displayName: 'Google' },
      { id: 'github', displayName: 'GitHub' },
      { id: 'facebook', displayName: 'Facebook' },
      { id: 'microsoft', displayName: 'Microsoft' },
      { id: 'apple', displayName: 'Apple' },
      { id: 'discord', displayName: 'Discord' },
      { id: 'linkedin', displayName: 'LinkedIn' },
      { id: 'gitlab', displayName: 'GitLab' },
      { id: 'x', displayName: 'X' },
      { id: 'slack', displayName: 'Slack' },
      { id: 'twitch', displayName: 'Twitch' },
      { id: 'oidc', displayName: 'Single sign-on' },
    ]);
  });

  it('serves the generic provider under the id it was given', () => {
    const registry = registryFor({
      ...PROVIDER_ENV,
      OAUTH_OIDC_PROVIDER_ID: 'keycloak',
      OAUTH_OIDC_DISPLAY_NAME: 'Company account',
    });

    expect(registry.has('oidc')).toBe(false);
    expect(registry.isEnabled('keycloak')).toBe(true);
    expect(registry.getCallbackUrl('keycloak')).toBe(
      `${CALLBACK_BASE_URL}/keycloak/callback`,
    );
  });

  it('keeps the generic provider off until its endpoints resolve', () => {
    const withoutEndpoints = { ...PROVIDER_ENV };
    delete withoutEndpoints.OAUTH_OIDC_JWKS_URL;

    // Discovery only runs in onModuleInit, which no strategy here has had.
    expect(registryFor(withoutEndpoints).isEnabled('oidc')).toBe(false);
  });

  it('leaves every provider off when nothing is configured', () => {
    expect(registryFor({}).listEnabled()).toEqual([]);
  });

  it('derives one callback URL per provider', () => {
    const registry = registryFor(PROVIDER_ENV);

    for (const id of registry.getIds()) {
      expect(registry.getCallbackUrl(id)).toBe(
        `${CALLBACK_BASE_URL}/${id}/callback`,
      );
    }
  });

  it('keeps Apple off until the whole sign-in key is present', () => {
    const withoutKey = { ...PROVIDER_ENV };
    delete withoutKey.OAUTH_APPLE_PRIVATE_KEY;

    expect(registryFor(withoutKey).isEnabled('apple')).toBe(false);
  });

  it('sends only Apple through a POST callback', () => {
    const registry = registryFor(PROVIDER_ENV);
    const posting = registry
      .getIds()
      .filter((id) => registry.get(id).callbackMethod === 'POST');

    expect(posting).toEqual(['apple']);
  });
});
