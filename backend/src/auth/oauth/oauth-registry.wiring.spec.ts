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
import { createOAuthConfig } from '../../config/oauth.config';

/**
 * Every registered provider, built from environment variables the way the
 * running application builds them. This covers the part of the boot check that
 * does not need a database: the config reader, each strategy and the registry
 * agreeing on the same provider ids.
 */

const CALLBACK_BASE_URL = 'https://api.example.com/api/auth/oauth';

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
    ]);
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
