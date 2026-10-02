import { ApiError, OAuthError, OAUTH_ERROR as SDK_OAUTH_ERROR } from '@app/sdk';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CREDENTIAL_PURPOSE } from '../src/session/constants/credential-purpose';
import { OAUTH_ERROR } from '../src/session/native/native-oauth.types';
import {
  Session,
  SessionDocument,
} from '../src/session/schemas/session.schema';
import { SEED_USER } from './constants/seed-users';
import { bootE2eApp, loginAs, type E2eApp } from './utils/e2e-app';
import { TEST_NOW } from './utils/frozen-clock';
import {
  createNativeApplication,
  NATIVE_CLIENT_ID,
} from './utils/native-authorize.fixtures';
import {
  apiErrorOf,
  bearerClient,
  cookieClient,
  publicClient,
  rejectionOf,
  required,
  signInNative,
} from './utils/sdk-transport';
import { SESSION_AUTHORITY_BOOT_TIMEOUT_MS } from './utils/session-authority-harness';

const OBJECT_ID = /^[0-9a-f]{24}$/;

function isIsoDate(value: unknown): boolean {
  return typeof value === 'string' && new Date(value).toISOString() === value;
}

describe('sdk constants', () => {
  it('names the same OAuth failures as the server', () => {
    expect(Object.entries(SDK_OAUTH_ERROR).sort()).toEqual(
      Object.entries(OAUTH_ERROR).sort(),
    );
  });
});

describe('sdk contract (e2e)', () => {
  let e2e: E2eApp;

  /** The session the bearer itself runs on, which the sessions list never shows it. */
  async function nativeSessionId(): Promise<string> {
    const sessions = e2e.app.get<Model<SessionDocument>>(
      getModelToken(Session.name),
    );
    const native = await sessions
      .findOne({ credentialPurpose: CREDENTIAL_PURPOSE.NATIVE_ACCESS })
      .exec();
    return required(native, 'native session')._id.toString();
  }

  beforeAll(async () => {
    e2e = await bootE2eApp();
  }, SESSION_AUTHORITY_BOOT_TIMEOUT_MS);

  afterAll(async () => {
    await e2e?.close();
  });

  beforeEach(async () => {
    e2e.clock.set(TEST_NOW);
    await e2e.reset();
    e2e.app.get(ConfigService).set('auth.nativeEnabled', true);
    await createNativeApplication(e2e);
  });

  it('reads and updates the profile over a cookie session', async () => {
    const client = cookieClient(await loginAs(e2e.httpServer, SEED_USER));

    const profile = await client.profile.get();
    expect(profile).toMatchObject({
      email: 'user@seed.local',
      name: 'Seed User',
      role: 'user',
      authProvider: 'email',
      isVerified: true,
      linkedProviders: ['email'],
    });
    expect(profile.id).toMatch(OBJECT_ID);
    expect(profile.permissions).toEqual(
      expect.arrayContaining(['profile:read:own', 'profile:update:own']),
    );
    expect(profile.twoFactorEnabled).toBe(false); // feature:totp
    expect(profile.passkeyCount).toBe(0); // feature:passkeys
    expect(isIsoDate(profile.createdAt)).toBe(true);
    expect(isIsoDate(profile.updatedAt)).toBe(true);

    const updated = await client.profile.update({ name: 'Contract User' });
    expect(updated.name).toBe('Contract User');
    expect(updated.id).toBe(profile.id);
    expect((await client.profile.get()).name).toBe('Contract User');
  });

  it('surfaces the field errors of a refused profile update', async () => {
    const client = cookieClient(await loginAs(e2e.httpServer, SEED_USER));

    const error = await apiErrorOf(client.profile.update({ name: 'A' }));

    expect(error.status).toBe(400);
    expect(error.code).toBe('VALIDATION_ERROR');
    // The server names the field after the first word of the message: `Name`, not `name`.
    expect(Object.keys(required(error.fields, 'field errors'))).toEqual([
      'Name',
    ]);
    expect(error.fields?.Name).toHaveLength(1);
    expect((await client.profile.get()).name).toBe('Seed User');
  });

  it('lists the sessions and revokes one of them', async () => {
    const client = cookieClient(await loginAs(e2e.httpServer, SEED_USER));
    await loginAs(e2e.httpServer, SEED_USER);

    const list = await client.sessions.list();
    expect(list.total).toBe(2);
    expect(list.sessions).toHaveLength(2);
    expect(list.sessions.map((session) => session.isCurrent).sort()).toEqual([
      false,
      true,
    ]);
    for (const session of list.sessions) {
      expect(session.id).toMatch(OBJECT_ID);
      expect(session.userAgent.length).toBeGreaterThan(0);
      expect(session.ip.length).toBeGreaterThan(0);
      expect(isIsoDate(session.createdAt)).toBe(true);
    }
    const current = required(
      list.sessions.find((session) => session.isCurrent),
      'current session',
    );
    const other = required(
      list.sessions.find((session) => !session.isCurrent),
      'other session',
    );

    const refused = await apiErrorOf(client.sessions.revoke(current.id));
    expect(refused.status).toBe(400);
    expect(refused.code).toBe('CANNOT_REVOKE_CURRENT_SESSION');

    const revoked = await client.sessions.revoke(other.id);
    expect(revoked.message.length).toBeGreaterThan(0);
    const remaining = await client.sessions.list();
    expect(remaining.total).toBe(1);
    expect(remaining.sessions.map((session) => session.id)).toEqual([
      current.id,
    ]);
  });

  it('revokes every other session and reports how many', async () => {
    const client = cookieClient(await loginAs(e2e.httpServer, SEED_USER));
    await loginAs(e2e.httpServer, SEED_USER);
    await loginAs(e2e.httpServer, SEED_USER);

    expect(await client.sessions.revokeOthers()).toEqual({ revokedCount: 2 });
    expect((await client.sessions.list()).total).toBe(1);
  });

  it('reads the sign-in methods without a session', async () => {
    const methods = await publicClient(e2e).auth.methods();

    expect(methods.password).toBe(true);
    expect(methods.magicLink).toBe(false);
    expect(methods.twoFactor).toBe(true); // feature:totp
    expect(methods.passkeys).toBe(true); // feature:passkeys
    expect(methods.oauth).toEqual([]);
  });

  it('signs out and the cookie session stops working', async () => {
    const client = cookieClient(await loginAs(e2e.httpServer, SEED_USER));

    const result = await client.auth.signOut();
    expect(result.message.length).toBeGreaterThan(0);

    const error = await apiErrorOf(client.profile.get());
    expect(error.status).toBe(401);
    expect(error.code).toBe('SESSION_REQUIRED');
  });

  it('exchanges a code, reads the profile with the bearer, refreshes and revokes', async () => {
    const { tokens } = await signInNative(e2e);
    const client = publicClient(e2e);

    expect(tokens).toEqual({
      accessToken: expect.any(String),
      tokenType: 'Bearer',
      expiresIn: 300,
      refreshToken: expect.any(String),
      scope: 'api',
    });
    expect(tokens.accessToken).not.toBe(tokens.refreshToken);

    const profile = await bearerClient(e2e, tokens.accessToken).profile.get();
    expect(profile.email).toBe('user@seed.local');

    const refreshed = await client.oauth.refresh({
      refreshToken: tokens.refreshToken,
      clientId: NATIVE_CLIENT_ID,
    });
    expect(refreshed.tokenType).toBe('Bearer');
    expect(refreshed.expiresIn).toBe(300);
    expect(refreshed.accessToken).not.toBe(tokens.accessToken);
    expect(refreshed.refreshToken).not.toBe(tokens.refreshToken);
    expect(
      (await bearerClient(e2e, refreshed.accessToken).profile.get()).email,
    ).toBe('user@seed.local');

    const revoked = await client.oauth.revoke({
      token: refreshed.refreshToken,
      clientId: NATIVE_CLIENT_ID,
    });
    expect(revoked).toBeUndefined();

    const afterRevoke = await apiErrorOf(
      bearerClient(e2e, refreshed.accessToken).profile.get(),
    );
    expect(afterRevoke.status).toBe(401);
    expect(afterRevoke.code).toBe('SESSION_INVALID');

    const reused = await rejectionOf(
      client.oauth.refresh({
        refreshToken: refreshed.refreshToken,
        clientId: NATIVE_CLIENT_ID,
      }),
    );
    expect(reused).toBeInstanceOf(OAuthError);
    expect(reused).not.toBeInstanceOf(ApiError);
    expect(reused).toMatchObject({ status: 400, error: 'invalid_grant' });
  });

  // Each case pins what the server does today. The server piece that makes
  // these routes read the bearer's own session must change the expectations.
  describe('KNOWN GAP: cookie-only session routes on a bearer transport', () => {
    it('refuses sign out with 401 SESSION_INVALID and leaves the bearer signed in', async () => {
      const { tokens } = await signInNative(e2e);
      const client = bearerClient(e2e, tokens.accessToken);

      const error = await apiErrorOf(client.auth.signOut());

      expect(error.status).toBe(401);
      expect(error.code).toBe('SESSION_INVALID');
      expect((await client.profile.get()).email).toBe('user@seed.local');
    });

    it('refuses revoking the other sessions with 401 SESSION_INVALID and revokes none', async () => {
      const { browser, tokens } = await signInNative(e2e);

      const error = await apiErrorOf(
        bearerClient(e2e, tokens.accessToken).sessions.revokeOthers(),
      );

      expect(error.status).toBe(401);
      expect(error.code).toBe('SESSION_INVALID');
      expect((await cookieClient(browser).profile.get()).email).toBe(
        'user@seed.local',
      );
    });

    it('lists browser sessions only, none of them current, and not the bearer itself', async () => {
      const { tokens } = await signInNative(e2e);

      const list = await bearerClient(e2e, tokens.accessToken).sessions.list();

      expect(list.total).toBe(1);
      expect(list.sessions.map((session) => session.isCurrent)).toEqual([
        false,
      ]);
      expect(list.sessions.map((session) => session.id)).not.toContain(
        await nativeSessionId(),
      );
    });

    it('lets a bearer revoke the session it is running on', async () => {
      const { tokens } = await signInNative(e2e);
      const client = bearerClient(e2e, tokens.accessToken);

      const revoked = await client.sessions.revoke(await nativeSessionId());

      expect(revoked.message.length).toBeGreaterThan(0);
      const error = await apiErrorOf(client.profile.get());
      expect(error.status).toBe(401);
      expect(error.code).toBe('SESSION_INVALID');
    });
  });
});
