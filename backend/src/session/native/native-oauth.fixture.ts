import { createHash, randomBytes } from 'crypto';
import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import type { Server } from 'node:http';
import { Model } from 'mongoose';
import {
  APPLICATION_CLIENT_TYPE,
  APPLICATION_PLATFORM,
  DEFAULT_API_AUDIENCE,
} from '../constants/client-ids';
import {
  NATIVE_ABSOLUTE_LIFETIME_MS,
  NATIVE_IDLE_LIFETIME_MS,
} from '../constants/session-policy';
import { NativeAccessService } from './native-access.service';
import { NativeAuthorizeService } from './native-authorize.service';
import { AuthorizeQuery, TokenSuccess } from './native-oauth.types';
import { NativeTokenService } from './native-token.service';
import {
  AuthorizationTransaction,
  AuthorizationTransactionDocument,
} from '../schemas/authorization-transaction.schema';
import {
  NativeCredential,
  NativeCredentialDocument,
} from '../schemas/native-credential.schema';
import { startMemoryReplSet } from '../../../test/utils/memory-replset';
import { FrozenClock } from '../../../test/utils/frozen-clock';
import {
  bootSessionAuthority,
  createTestUser,
  SessionAuthorityHarness,
} from '../../../test/utils/session-authority-harness';

export const NATIVE_CLIENT_ID = 'native-app';
export const NATIVE_REDIRECT = 'myapp://callback';
export const NATIVE_META = { ip: '203.0.113.10', userAgent: 'NativeTest/1' };
// MongoDB's TTL monitor uses real time, so keep this fixture date ahead of it.
export const NATIVE_STARTED = new Date('2099-01-01T12:00:00.000Z');

export interface NativeOauthHarness {
  mongo: Awaited<ReturnType<typeof startMemoryReplSet>>;
  harness: SessionAuthorityHarness;
  authorize: NativeAuthorizeService;
  tokens: NativeTokenService;
  access: NativeAccessService;
  transactions: Model<AuthorizationTransactionDocument>;
  credentials: Model<NativeCredentialDocument>;
}

export function nativeAuthorizeQuery(
  verifier: string,
  overrides: Partial<AuthorizeQuery> = {},
): AuthorizeQuery {
  return {
    response_type: 'code',
    client_id: NATIVE_CLIENT_ID,
    redirect_uri: NATIVE_REDIRECT,
    code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    code_challenge_method: 'S256',
    state: 'state-1',
    ...overrides,
  };
}

export function nativeHttpServer(app: INestApplication): Server {
  return app.getHttpServer() as Server;
}

export async function startNativeOauth(
  dbName: string,
): Promise<NativeOauthHarness> {
  const mongo = await startMemoryReplSet();
  const harness = await bootSessionAuthority(
    mongo.uri(dbName),
    new FrozenClock(NATIVE_STARTED),
    { nativeEnabled: true, withNativeHttp: true },
  );
  return {
    mongo,
    harness,
    authorize: harness.app.get(NativeAuthorizeService),
    tokens: harness.app.get(NativeTokenService),
    access: harness.app.get(NativeAccessService),
    transactions: harness.app.get(getModelToken(AuthorizationTransaction.name)),
    credentials: harness.app.get(getModelToken(NativeCredential.name)),
  };
}

export async function stopNativeOauth(ctx: NativeOauthHarness): Promise<void> {
  await ctx.harness.app.close();
  await ctx.mongo.stop();
}

export async function resetNativeClient(
  ctx: NativeOauthHarness,
): Promise<void> {
  ctx.harness.clock.set(NATIVE_STARTED);
  await ctx.harness.sessions.deleteMany({});
  await ctx.harness.grants.deleteMany({});
  await ctx.harness.users.deleteMany({});
  await ctx.transactions.deleteMany({});
  await ctx.credentials.deleteMany({});
  await ctx.harness.applications.deleteMany({ clientId: NATIVE_CLIENT_ID });
  await ctx.harness.applications.create({
    clientId: NATIVE_CLIENT_ID,
    displayName: 'Native',
    platform: APPLICATION_PLATFORM.NATIVE,
    environment: 'test',
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
    issuanceFence: 0,
  });
}

export async function issueNativeGrant(
  ctx: NativeOauthHarness,
): Promise<TokenSuccess> {
  const verifier = randomBytes(32).toString('base64url');
  const begun = await ctx.authorize.begin(nativeAuthorizeQuery(verifier));
  if (!begun.ok) {
    throw new Error(begun.error);
  }
  const user = await createTestUser(ctx.harness.users, 'native@example.com');
  const approved = await ctx.authorize.approve(
    user._id.toString(),
    begun.transactionId,
    ['password'],
  );
  const code = new URL(approved.redirectUri).searchParams.get('code');
  if (!code) {
    throw new Error('missing code');
  }
  const granted = await ctx.tokens.grant(
    {
      grant_type: 'authorization_code',
      code,
      redirect_uri: NATIVE_REDIRECT,
      client_id: NATIVE_CLIENT_ID,
      code_verifier: verifier,
    },
    NATIVE_META,
  );
  if (!granted.ok) {
    throw new Error(granted.error);
  }
  return granted;
}
