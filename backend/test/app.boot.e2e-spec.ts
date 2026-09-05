import request from 'supertest';
import type { Response } from 'supertest';
import { bootE2eApp, type E2eApp } from './utils/e2e-app';
import {
  OAUTH_BOOT_PROVIDER_IDS,
  applyOAuthBootEnv,
} from './constants/oauth-boot-env';

/**
 * Smoke test for the wiring itself: the whole AppModule has to compile and
 * answer on its two unauthenticated routes. It catches provider graph breakage,
 * such as a global guard whose dependencies do not resolve.
 *
 * Every OAuth provider is switched on with dummy credentials before the app
 * boots, so a strategy that cannot be constructed or registered fails here.
 *
 * Runs against the MONGO_URI of the environment, like the other e2e suites. To
 * run it without a database, install mongodb-memory-server
 * (`npm i -D mongodb-memory-server -w backend`) and set process.env.MONGO_URI
 * from `MongoMemoryServer.create()` in a beforeAll before bootE2eApp().
 */
interface HealthBody {
  status: string;
  timestamp: string;
}

interface ProvidersBody {
  success: boolean;
  data: {
    providers: { id: string; displayName: string }[];
  };
}

interface MethodsBody {
  success: boolean;
  data: {
    methods: {
      password: boolean;
      magicLink: boolean;
      twoFactor: boolean;
      passkeys: boolean;
      oauth: { id: string; displayName: string }[];
    };
  };
}

interface OptionsBody {
  data: {
    challenge: string;
    allowCredentials: unknown[];
  };
}

interface ErrorBody {
  error: { code: string };
}

describe('AppModule boot (e2e)', () => {
  let e2e: E2eApp;
  let restoreEnv: () => void;

  beforeAll(async () => {
    restoreEnv = applyOAuthBootEnv();
    e2e = await bootE2eApp();
  });

  afterAll(async () => {
    await e2e.app.close();
    restoreEnv();
  });

  it('should answer the health check', async () => {
    const response: Response = await request(e2e.httpServer).get('/health');

    expect([200, 503]).toContain(response.status);

    const body = response.body as HealthBody;
    expect(['healthy', 'unhealthy']).toContain(body.status);
    expect(typeof body.timestamp).toBe('string');
  });

  it('should list OAuth providers without a session', async () => {
    const response: Response = await request(e2e.httpServer)
      .get('/api/auth/oauth/providers')
      .expect(200);

    const body = response.body as ProvidersBody;
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data.providers)).toBe(true);
  });

  it('should list every registered provider once its variables are set', async () => {
    const response: Response = await request(e2e.httpServer)
      .get('/api/auth/oauth/providers')
      .expect(200);

    const listed = (response.body as ProvidersBody).data.providers.map(
      (provider) => provider.id,
    );

    expect(listed).toEqual(expect.arrayContaining(OAUTH_BOOT_PROVIDER_IDS));
    for (const provider of (response.body as ProvidersBody).data.providers) {
      expect(provider.displayName).toEqual(expect.any(String));
    }
  });

  it('should list the enabled sign-in methods without a session', async () => {
    const response: Response = await request(e2e.httpServer)
      .get('/api/auth/methods')
      .expect(200);

    const body = response.body as MethodsBody;
    expect(body.success).toBe(true);
    expect(typeof body.data.methods.password).toBe('boolean');
    expect(typeof body.data.methods.magicLink).toBe('boolean');
    expect(typeof body.data.methods.twoFactor).toBe('boolean');
    expect(typeof body.data.methods.passkeys).toBe('boolean');
    expect(Array.isArray(body.data.methods.oauth)).toBe(true);
  });

  it('should hide the magic link route while the method is off', async () => {
    const methods: Response = await request(e2e.httpServer)
      .get('/api/auth/methods')
      .expect(200);

    if ((methods.body as MethodsBody).data.methods.magicLink) {
      // Requesting a link with the method on would mail one.
      return;
    }

    const response: Response = await request(e2e.httpServer)
      .post('/api/auth/magic-link/request')
      .send({ email: 'nobody@example.com' })
      .expect(404);

    expect((response.body as ErrorBody).error.code).toBe('FEATURE_DISABLED');
  });

  it('should refuse an unknown verify token without a session', async () => {
    const methods: Response = await request(e2e.httpServer)
      .get('/api/auth/methods')
      .expect(200);

    const magicLinkOn = (methods.body as MethodsBody).data.methods.magicLink;
    const response: Response = await request(e2e.httpServer)
      .post('/api/auth/magic-link/verify')
      .send({ token: 'not-a-token' });

    expect(response.status).toBe(magicLinkOn ? 400 : 404);
    expect((response.body as ErrorBody).error.code).toBe(
      magicLinkOn ? 'MAGIC_LINK_INVALID' : 'FEATURE_DISABLED',
    );
  });

  it('should answer the two-factor verify route without a session', async () => {
    const methods: Response = await request(e2e.httpServer)
      .get('/api/auth/methods')
      .expect(200);

    const twoFactorOn = (methods.body as MethodsBody).data.methods.twoFactor;
    const response: Response = await request(e2e.httpServer)
      .post('/api/auth/2fa/verify')
      .send({ code: '123456' });

    // Public route, so a request without the challenge cookie reaches the
    // handler and is turned away there rather than by the session guard.
    expect(response.status).toBe(twoFactorOn ? 401 : 404);
    expect((response.body as ErrorBody).error.code).toBe(
      twoFactorOn ? 'TWO_FACTOR_CHALLENGE_INVALID' : 'FEATURE_DISABLED',
    );
  });

  it('should keep the two-factor setup route behind a session', async () => {
    // The session guard is global and runs before the feature guard, so this
    // answers the same way whether or not the feature is on.
    const response: Response = await request(e2e.httpServer)
      .post('/api/auth/2fa/setup')
      .send({})
      .expect(401);

    expect((response.body as ErrorBody).error.code).toBe('SESSION_REQUIRED');
  });

  it('should hand out passkey sign-in options without a session', async () => {
    const methods: Response = await request(e2e.httpServer)
      .get('/api/auth/methods')
      .expect(200);

    const passkeysOn = (methods.body as MethodsBody).data.methods.passkeys;
    const response: Response = await request(e2e.httpServer)
      .post('/api/auth/passkeys/login/options')
      .send({});

    if (!passkeysOn) {
      expect(response.status).toBe(404);
      expect((response.body as ErrorBody).error.code).toBe('FEATURE_DISABLED');
      return;
    }

    expect(response.status).toBe(200);
    const body = response.body as OptionsBody;
    expect(typeof body.data.challenge).toBe('string');
    // Discoverable credentials only, and nothing that would confirm an account.
    expect(body.data.allowCredentials).toEqual([]);
    expect(response.headers['set-cookie']).toEqual(
      expect.arrayContaining([expect.stringContaining('pk_challenge=')]),
    );
  });

  it('should answer the passkey verify route without a session', async () => {
    const methods: Response = await request(e2e.httpServer)
      .get('/api/auth/methods')
      .expect(200);

    const passkeysOn = (methods.body as MethodsBody).data.methods.passkeys;
    const response: Response = await request(e2e.httpServer)
      .post('/api/auth/passkeys/login/verify')
      .send({
        response: {
          id: 'unknown',
          rawId: 'unknown',
          response: {},
          clientExtensionResults: {},
          type: 'public-key',
        },
      });

    // Public route, so a request without the challenge cookie reaches the
    // handler and is turned away there rather than by the session guard.
    expect(response.status).toBe(passkeysOn ? 401 : 404);
    expect((response.body as ErrorBody).error.code).toBe(
      passkeysOn ? 'PASSKEY_CHALLENGE_INVALID' : 'FEATURE_DISABLED',
    );
  });

  it('should keep the passkey list behind a session', async () => {
    // The session guard is global and runs before the feature guard, so this
    // answers the same way whether or not the method is on.
    const response: Response = await request(e2e.httpServer)
      .get('/api/auth/passkeys')
      .expect(401);

    expect((response.body as ErrorBody).error.code).toBe('SESSION_REQUIRED');
  });

  it('should return a request id header', async () => {
    const response: Response = await request(e2e.httpServer).get('/health');

    expect(response.headers['x-request-id']).toEqual(expect.any(String));
  });
});
