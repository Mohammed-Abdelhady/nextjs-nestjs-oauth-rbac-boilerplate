import { ErrorCode } from '../src/common/enums/error-code.enum';
import type { OAuthProviderStrategy } from '../src/auth/oauth/oauth-provider.interface';
import { SEED_USER } from './constants/seed-users';
import { bootE2eApp, loginAs, type E2eApp } from './utils/e2e-app';
import {
  SESSION_AUTHORITY_BOOT_TIMEOUT_MS,
  SESSION_AUTHORITY_TEARDOWN_TIMEOUT_MS,
} from './utils/session-authority-harness';
import { TEST_NOW } from './utils/frozen-clock';

const GOOGLE_STRATEGY: OAuthProviderStrategy = {
  id: 'google',
  displayName: 'Google',
  envPrefix: 'OAUTH_GOOGLE',
  supportsPkce: true,
  usesOidc: false,
  emailAlwaysVerified: true,
  callbackMethod: 'GET',
  isEnabled: () => true,
  getAuthorizationUrl: () => 'https://provider.example/authorize',
  exchangeCode: () => Promise.reject(new Error('unused in this spec')),
  fetchProfile: () => Promise.reject(new Error('unused in this spec')),
};

describe('provider link start with both credentials (e2e)', () => {
  let e2e: E2eApp;

  beforeAll(async () => {
    e2e = await bootE2eApp(0, { browserStrategy: GOOGLE_STRATEGY });
  }, SESSION_AUTHORITY_BOOT_TIMEOUT_MS);

  afterAll(async () => {
    await e2e?.close();
  }, SESSION_AUTHORITY_TEARDOWN_TIMEOUT_MS);

  beforeEach(async () => {
    e2e.clock.set(TEST_NOW);
    await e2e.reset();
  });

  it('refuses a link start carrying both a cookie and a bearer token', async () => {
    const browser = await loginAs(e2e.httpServer, SEED_USER);

    const mixed = await browser
      .get('/api/auth/oauth/google/start')
      .query({ intent: 'link' })
      .set('Authorization', 'Bearer native-token')
      .redirects(0);

    expect(mixed.status).toBe(302);
    const location = new URL(String(mixed.headers.location));
    expect(location.searchParams.get('status')).toBe('error');
    expect(location.searchParams.get('code')).toBe(ErrorCode.MIXED_CREDENTIALS);
    expect(location.searchParams.get('provider')).toBe('google');
  });

  it('starts a link with the cookie alone', async () => {
    const browser = await loginAs(e2e.httpServer, SEED_USER);

    const started = await browser
      .get('/api/auth/oauth/google/start')
      .query({ intent: 'link' })
      .redirects(0);

    expect(started.status).toBe(302);
    expect(String(started.headers.location)).toBe(
      'https://provider.example/authorize',
    );
  });
});
