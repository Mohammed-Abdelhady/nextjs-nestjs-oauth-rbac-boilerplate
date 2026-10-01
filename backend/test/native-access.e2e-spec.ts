import { randomBytes } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import request from 'supertest';
import { ErrorCode } from '../src/common/enums/error-code.enum';
import {
  APPLICATION_CLIENT_TYPE,
  APPLICATION_PLATFORM,
  DEFAULT_API_AUDIENCE,
} from '../src/session/constants/client-ids';
import {
  NATIVE_ABSOLUTE_LIFETIME_MS,
  NATIVE_IDLE_LIFETIME_MS,
} from '../src/session/constants/session-policy';
import {
  Application,
  ApplicationDocument,
} from '../src/session/schemas/application.schema';
import {
  AuthorizationTransaction,
  AuthorizationTransactionDocument,
} from '../src/session/schemas/authorization-transaction.schema';
import {
  NativeCredential,
  NativeCredentialDocument,
} from '../src/session/schemas/native-credential.schema';
import { AuthEpochService } from '../src/common/services/auth-epoch.service';
import { NativeAuthorizeService } from '../src/session/native/native-authorize.service';
import { NativeTokenService } from '../src/session/native/native-token.service';
import { OAUTH_ERROR } from '../src/session/native/native-oauth.types';
import {
  NATIVE_CLIENT_ID,
  NATIVE_META,
  NATIVE_REDIRECT,
  approvalRedirectUri,
  nativeAuthorizeQuery,
} from '../src/session/native/native-oauth.fixture';
import { User, UserDocument } from '../src/user/schemas/user.schema';
import { SEED_USER } from './constants/seed-users';
import { bootE2eApp, loginAs, type E2eApp } from './utils/e2e-app';
import { SESSION_AUTHORITY_BOOT_TIMEOUT_MS } from './utils/session-authority-harness';
import { TEST_NOW } from './utils/frozen-clock';

interface ApiErrorBody {
  error: { code: string };
}

interface NativeGrant {
  accessToken: string;
  refreshToken: string;
}

describe('native access (e2e)', () => {
  let e2e: E2eApp;

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

  it('accepts native unsafe requests and still checks invalid bearers', async () => {
    const grant = await issueNativeGrant(e2e);
    const update = await request(e2e.httpServer)
      .patch('/api/user/profile')
      .set('Authorization', `Bearer ${grant.accessToken}`)
      .set('Origin', 'https://native-client.invalid')
      .send({ name: 'Native Client User' });

    expect(update.status).toBe(200);
    expect(update.body.data.name).toBe('Native Client User');

    const invalid = await request(e2e.httpServer)
      .patch('/api/user/profile')
      .set('Authorization', 'Bearer invalid-native-token')
      .send({ name: 'Rejected Update' });
    expect(invalid.status).toBe(401);
    expect((invalid.body as ApiErrorBody).error.code).toBe(
      ErrorCode.SESSION_INVALID,
    );

    const publicUnsafe = await request(e2e.httpServer)
      .post('/api/auth/login')
      .set('Authorization', 'Bearer invalid-native-token')
      .send({ email: SEED_USER.email, password: SEED_USER.password });
    expect(publicUnsafe.status).toBe(403);
    expect((publicUnsafe.body as ApiErrorBody).error.code).toBe(
      ErrorCode.CSRF_REQUIRED,
    );

    const browser = await loginAs(e2e.httpServer, SEED_USER);
    const mixed = await browser
      .get('/api/user/profile')
      .set('Authorization', `Bearer ${grant.accessToken}`);
    expect(mixed.status).toBe(400);
    expect((mixed.body as ApiErrorBody).error.code).toBe(
      ErrorCode.MIXED_CREDENTIALS,
    );
  });

  it('refuses native OAuth while disabled and restores existing credentials', async () => {
    const grant = await issueNativeGrant(e2e);
    const user = await seedUser(e2e);
    const approved = await approveNativeCode(e2e, user._id.toString());
    const pending = await beginNativeAuthorization(e2e);
    const browser = await loginAs(e2e.httpServer, SEED_USER);
    e2e.app.get(ConfigService).set('auth.nativeEnabled', false);

    const start = await request(e2e.httpServer)
      .get('/api/oauth/authorize')
      .query(nativeAuthorizeQuery(randomBytes(32).toString('base64url')));
    expect(start.status).toBe(400);
    expect(start.body).toEqual({ error: OAUTH_ERROR.UNAUTHORIZED_CLIENT });
    expect(start.headers['cache-control']).toBe('no-store');

    const approval = await browser
      .post('/api/oauth/authorize/approve')
      .send({ transactionId: pending });
    expect(approval.status).toBe(403);
    expect((approval.body as ApiErrorBody).error.code).toBe(
      ErrorCode.NATIVE_AUTH_DISABLED,
    );
    const transactions = e2e.app.get<Model<AuthorizationTransactionDocument>>(
      getModelToken(AuthorizationTransaction.name),
    );
    expect(
      (await transactions.findOne({ transactionId: pending }).exec())?.codeHash,
    ).toBeUndefined();

    const exchange = await request(e2e.httpServer)
      .post('/api/oauth/token')
      .send({
        grant_type: 'authorization_code',
        code: approved.code,
        redirect_uri: NATIVE_REDIRECT,
        client_id: NATIVE_CLIENT_ID,
        code_verifier: approved.verifier,
      });
    expect(exchange.status).toBe(400);
    expect(exchange.body).toEqual({ error: OAUTH_ERROR.UNAUTHORIZED_CLIENT });

    const refresh = await request(e2e.httpServer)
      .post('/api/oauth/token')
      .send({
        grant_type: 'refresh_token',
        refresh_token: grant.refreshToken,
        client_id: NATIVE_CLIENT_ID,
      });
    expect(refresh.status).toBe(400);
    expect(refresh.body).toEqual({ error: OAUTH_ERROR.UNAUTHORIZED_CLIENT });

    const revoke = await request(e2e.httpServer)
      .post('/api/oauth/revoke')
      .send({ token: grant.accessToken, client_id: NATIVE_CLIENT_ID });
    expect(revoke.status).toBe(400);
    expect(revoke.body).toEqual({ error: OAUTH_ERROR.UNAUTHORIZED_CLIENT });

    const credentials = e2e.app.get<Model<NativeCredentialDocument>>(
      getModelToken(NativeCredential.name),
    );
    expect(await credentials.countDocuments()).toBe(2);

    const disabledAccess = await request(e2e.httpServer)
      .patch('/api/user/profile')
      .set('Authorization', `Bearer ${grant.accessToken}`)
      .send({ name: 'Disabled Native Access' });
    expect(disabledAccess.status).toBe(403);
    expect((disabledAccess.body as ApiErrorBody).error.code).toBe(
      ErrorCode.NATIVE_AUTH_DISABLED,
    );

    e2e.app.get(ConfigService).set('auth.nativeEnabled', true);
    const resumedExchange = await request(e2e.httpServer)
      .post('/api/oauth/token')
      .send({
        grant_type: 'authorization_code',
        code: approved.code,
        redirect_uri: NATIVE_REDIRECT,
        client_id: NATIVE_CLIENT_ID,
        code_verifier: approved.verifier,
      })
      .expect(200);
    expect(typeof resumedExchange.body.access_token).toBe('string');

    const resumedAccess = await request(e2e.httpServer)
      .patch('/api/user/profile')
      .set('Authorization', `Bearer ${grant.accessToken}`)
      .set('Origin', 'https://native-client.invalid')
      .send({ name: 'Native Access Restored' });
    expect(resumedAccess.status).toBe(200);
    expect(resumedAccess.body.data.name).toBe('Native Access Restored');
    expect(await credentials.countDocuments()).toBe(4);
  });
});

async function createNativeApplication(e2e: E2eApp): Promise<void> {
  const applications = e2e.app.get<Model<ApplicationDocument>>(
    getModelToken(Application.name),
  );
  await applications.create({
    clientId: NATIVE_CLIENT_ID,
    displayName: 'Native test client',
    platform: APPLICATION_PLATFORM.NATIVE,
    environment: e2e.app.get(AuthEpochService).environment(),
    clientType: APPLICATION_CLIENT_TYPE.PUBLIC,
    enabled: true,
    redirectUris: [NATIVE_REDIRECT],
    allowedOrigins: [],
    audiences: [DEFAULT_API_AUDIENCE],
    allowedScopes: [DEFAULT_API_AUDIENCE],
    policy: {
      absoluteLifetimeMs: NATIVE_ABSOLUTE_LIFETIME_MS,
      idleLifetimeMs: NATIVE_IDLE_LIFETIME_MS,
    },
    sessionVersion: 0,
  });
}

async function issueNativeGrant(e2e: E2eApp): Promise<NativeGrant> {
  const user = await seedUser(e2e);
  const approved = await approveNativeCode(e2e, user._id.toString());
  const result = await e2e.app.get(NativeTokenService).grant(
    {
      grant_type: 'authorization_code',
      code: approved.code,
      redirect_uri: NATIVE_REDIRECT,
      client_id: NATIVE_CLIENT_ID,
      code_verifier: approved.verifier,
    },
    NATIVE_META,
  );
  if (!result.ok) {
    throw new Error(result.error);
  }
  return { accessToken: result.accessToken, refreshToken: result.refreshToken };
}

async function approveNativeCode(
  e2e: E2eApp,
  userId: string,
): Promise<{ code: string; verifier: string }> {
  const verifier = randomBytes(32).toString('base64url');
  const authorize = e2e.app.get(NativeAuthorizeService);
  const begun = await authorize.begin(nativeAuthorizeQuery(verifier));
  if (!begun.ok) {
    throw new Error(begun.error);
  }
  const approved = await authorize.approve(userId, begun.transactionId, [
    'password',
  ]);
  const code = new URL(approvalRedirectUri(approved)).searchParams.get('code');
  if (!code) {
    throw new Error('authorization code is missing');
  }
  return { code, verifier };
}

async function beginNativeAuthorization(e2e: E2eApp): Promise<string> {
  const authorize = e2e.app.get(NativeAuthorizeService);
  const begun = await authorize.begin(
    nativeAuthorizeQuery(randomBytes(32).toString('base64url')),
  );
  if (!begun.ok) {
    throw new Error(begun.error);
  }
  return begun.transactionId;
}

async function seedUser(e2e: E2eApp): Promise<UserDocument> {
  const users = e2e.app.get<Model<UserDocument>>(getModelToken(User.name));
  const user = await users.findOne({ email: SEED_USER.email }).exec();
  if (!user) {
    throw new Error('seed user is missing');
  }
  return user;
}
