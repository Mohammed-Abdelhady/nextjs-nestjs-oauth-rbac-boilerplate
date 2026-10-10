import { randomBytes } from 'crypto';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import request from 'supertest';
import { AuthEpochService } from '../../../src/common/services/auth-epoch.service';
import {
  APPLICATION_CLIENT_TYPE,
  APPLICATION_PLATFORM,
  DEFAULT_API_AUDIENCE,
} from '../../../src/session/constants/client-ids';
import {
  NATIVE_ABSOLUTE_LIFETIME_MS,
  NATIVE_IDLE_LIFETIME_MS,
} from '../../../src/session/constants/session-policy';
import {
  Application,
  ApplicationDocument,
} from '../../../src/session/persistence/mongo/schemas/application.schema';
import { AuthorizationTransactionDocument } from '../../../src/session/persistence/mongo/schemas/authorization-transaction.schema';
import {
  NATIVE_CLIENT_ID,
  NATIVE_REDIRECT,
  nativeAuthorizeQuery,
} from '../../../src/session/native/persistence/mongo/harness/native-oauth.harness-spec';
import type { E2eApp } from '../e2e-app';

export { NATIVE_CLIENT_ID, NATIVE_REDIRECT };

export interface StartedNativeAuthorization {
  transactionId: string;
  verifier: string;
  location: string;
}

export async function createNativeApplication(e2e: E2eApp): Promise<void> {
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

export async function beginNativeAuthorization(
  e2e: E2eApp,
  acceptLanguage?: string,
): Promise<StartedNativeAuthorization> {
  const verifier = randomBytes(32).toString('base64url');
  let call = request(e2e.httpServer)
    .get('/api/oauth/authorize')
    .query(nativeAuthorizeQuery(verifier));
  if (acceptLanguage) {
    call = call.set('Accept-Language', acceptLanguage);
  }
  const response = await call.redirects(0);
  const location = response.headers.location;
  if (response.status !== 302 || typeof location !== 'string') {
    throw new Error('Native authorization did not redirect to the browser');
  }
  const transactionId = new URL(location).searchParams.get('transaction');
  if (!transactionId) {
    throw new Error('Native authorization redirect has no transaction id');
  }
  return { transactionId, verifier, location };
}

export function pauseNextNativeAuthorizationRead(
  transactions: Model<AuthorizationTransactionDocument>,
) {
  let announceReached = () => {};
  let releaseRead = () => {};
  let shouldPause = true;
  const reached = new Promise<void>((resolve) => {
    announceReached = resolve;
  });
  const blocked = new Promise<void>((resolve) => {
    releaseRead = resolve;
  });
  const originalFindOne = transactions.findOne.bind(transactions);
  const spy = jest
    .spyOn(transactions, 'findOne')
    .mockImplementation((...args) => {
      const query = originalFindOne(...args);
      if (!shouldPause) {
        return query;
      }
      shouldPause = false;
      const originalExec = query.exec.bind(query);
      jest.spyOn(query, 'exec').mockImplementation(async (...execArgs) => {
        const transaction = await originalExec(...execArgs);
        announceReached();
        await blocked;
        return transaction;
      });
      return query;
    });

  return {
    reached,
    release: releaseRead,
    restore: () => spy.mockRestore(),
  };
}
