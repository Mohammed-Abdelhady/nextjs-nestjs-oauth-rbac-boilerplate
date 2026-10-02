import { getModelToken } from '@nestjs/mongoose';
import mongoose, { STATES, type Model } from 'mongoose';
import {
  Application,
  ApplicationDocument,
} from '../src/session/schemas/application.schema';
import {
  AuthorizationTransaction,
  AuthorizationTransactionDocument,
} from '../src/session/schemas/authorization-transaction.schema';
import {
  NATIVE_CLIENT_ID,
  NATIVE_REDIRECT,
  beginNativeAuthorization,
} from './utils/native-authorize.fixtures';
import { bootE2eApp, type E2eApp } from './utils/e2e-app';
import { SESSION_AUTHORITY_BOOT_TIMEOUT_MS } from './utils/session-authority-harness';

describe('native application configuration at startup', () => {
  let e2e: E2eApp | undefined;

  afterEach(async () => {
    await e2e?.close();
    e2e = undefined;
  });

  it(
    'starts authorization for a client declared only in configuration',
    async () => {
      e2e = await bootE2eApp(0, {
        nativeEnabled: true,
        nativeApplications: [
          {
            clientId: NATIVE_CLIENT_ID,
            displayName: 'Configured Mobile',
            redirectUris: [NATIVE_REDIRECT],
            allowedScopes: ['api'],
          },
        ],
      });

      const applications = e2e.app.get<Model<ApplicationDocument>>(
        getModelToken(Application.name),
      );
      const application = await applications
        .findOne({ clientId: NATIVE_CLIENT_ID })
        .exec();
      expect(application?.toObject()).toMatchObject({
        clientId: NATIVE_CLIENT_ID,
        displayName: 'Configured Mobile',
        platform: 'native',
        clientType: 'public',
        enabled: true,
        redirectUris: [NATIVE_REDIRECT],
      });

      const started = await beginNativeAuthorization(e2e);
      const transactions = e2e.app.get<Model<AuthorizationTransactionDocument>>(
        getModelToken(AuthorizationTransaction.name),
      );
      const transaction = await transactions
        .findOne({ transactionId: started.transactionId })
        .lean()
        .exec();
      expect(transaction).toMatchObject({
        transactionId: started.transactionId,
        clientId: NATIVE_CLIENT_ID,
        redirectUri: NATIVE_REDIRECT,
        consumed: false,
      });
    },
    SESSION_AUTHORITY_BOOT_TIMEOUT_MS,
  );

  it(
    'rejects an unacceptable redirect address before startup completes',
    async () => {
      const originalNativeEnabled = process.env.AUTH_NATIVE_ENABLED;
      process.env.AUTH_NATIVE_ENABLED = 'preserved-before-failed-boot';
      const originalDirectory = process.cwd();
      const originalEnvironment = new Map(Object.entries(process.env));
      const existingConnections = new Set(mongoose.connections);
      const probe = mongoose.createConnection();

      try {
        await expect(
          bootE2eApp(0, {
            nativeEnabled: true,
            nativeApplications: [
              {
                clientId: NATIVE_CLIENT_ID,
                displayName: 'Configured Mobile',
                redirectUris: ['http://example.com/callback'],
                allowedScopes: ['api'],
              },
            ],
          }),
        ).rejects.toThrow(/AUTH_NATIVE_APPLICATIONS.*redirectUris\[0\]/);

        const environmentRestored =
          [...originalEnvironment].every(
            ([key, value]) => process.env[key] === value,
          ) &&
          Object.keys(process.env).every((key) => originalEnvironment.has(key));
        const fixtureConnections = mongoose.connections.filter(
          (connection) =>
            !existingConnections.has(connection) && connection !== probe,
        );
        const retrying = fixtureConnections.filter(
          (connection) =>
            connection.readyState === STATES.connected ||
            connection.readyState === STATES.connecting,
        ).length;
        expect({
          directoryRestored: process.cwd() === originalDirectory,
          environmentRestored,
          probePreserved: mongoose.connections.includes(probe),
          retryingConnections: retrying,
        }).toEqual({
          directoryRestored: true,
          environmentRestored: true,
          probePreserved: true,
          retryingConnections: 0,
        });
      } finally {
        await probe.destroy(true).catch(() => undefined);
        process.chdir(originalDirectory);
        for (const key of Object.keys(process.env)) {
          if (!originalEnvironment.has(key)) delete process.env[key];
        }
        for (const [key, value] of originalEnvironment) {
          process.env[key] = value;
        }
        if (originalNativeEnabled === undefined) {
          delete process.env.AUTH_NATIVE_ENABLED;
        } else {
          process.env.AUTH_NATIVE_ENABLED = originalNativeEnabled;
        }
      }
    },
    SESSION_AUTHORITY_BOOT_TIMEOUT_MS,
  );

  it(
    'ignores an invalid native client list when native sign-in is disabled',
    async () => {
      e2e = await bootE2eApp(0, {
        nativeEnabled: false,
        nativeApplications: [
          {
            clientId: NATIVE_CLIENT_ID,
            displayName: 'Configured Mobile',
            redirectUris: ['http://example.com/callback'],
            allowedScopes: ['api'],
          },
        ],
      });

      const applications = e2e.app.get<Model<ApplicationDocument>>(
        getModelToken(Application.name),
      );
      expect(
        await applications.countDocuments({ clientId: NATIVE_CLIENT_ID }),
      ).toBe(0);
    },
    SESSION_AUTHORITY_BOOT_TIMEOUT_MS,
  );
});
