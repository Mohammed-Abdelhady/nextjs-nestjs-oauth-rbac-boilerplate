/**
 * Dummy credentials that switch every OAuth provider on for the boot check.
 * Nothing here reaches a provider: the boot spec only asks which providers the
 * application lists, it never starts a login.
 */

const OIDC_ISSUER = 'https://sso.example.com';

export const OAUTH_BOOT_ENV: Record<string, string> = {
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
  OAUTH_OIDC_ISSUER: OIDC_ISSUER,
  // All four endpoints given by hand, so the boot needs no discovery request.
  OAUTH_OIDC_AUTHORIZATION_URL: `${OIDC_ISSUER}/authorize`,
  OAUTH_OIDC_TOKEN_URL: `${OIDC_ISSUER}/token`,
  OAUTH_OIDC_USERINFO_URL: `${OIDC_ISSUER}/userinfo`,
  OAUTH_OIDC_JWKS_URL: `${OIDC_ISSUER}/jwks`,
};

export const OAUTH_BOOT_PROVIDER_IDS = [
  'google', // feature:google
  'github', // feature:github
  'facebook', // feature:facebook
  'microsoft', // feature:microsoft
  'apple', // feature:apple
  'discord', // feature:discord
  'linkedin', // feature:linkedin
  'gitlab', // feature:gitlab
  'x', // feature:x
  'slack', // feature:slack
  'twitch', // feature:twitch
  'oidc', // feature:oidc
];

/**
 * Applies the dummy credentials and returns a function that puts the previous
 * values back, so the next e2e file in the worker starts from a clean env.
 */
export function applyOAuthBootEnv(): () => void {
  const previous = new Map<string, string | undefined>();

  for (const [key, value] of Object.entries(OAUTH_BOOT_ENV)) {
    previous.set(key, process.env[key]);
    process.env[key] = value;
  }

  return (): void => {
    for (const [key, value] of previous) {
      if (value === undefined) {
        delete process.env[key];
        continue;
      }
      process.env[key] = value;
    }
  };
}
