import type { INestApplication } from '@nestjs/common';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import type { TestingModuleBuilder } from '@nestjs/testing';
import mongoose, { Connection, Model } from 'mongoose';
import {
  Application,
  ApplicationDocument,
} from '../../src/session/persistence/mongo/schemas/application.schema';
import {
  Session,
  SessionDocument,
} from '../../src/session/persistence/mongo/schemas/session.schema';
import type { UserDocument } from '../../src/user/persistence/mongo/schemas/user.schema';
import type {
  AttachedE2eStorage,
  E2eAccountFixture,
  E2eStorage,
} from './e2e-storage';
import { startMemoryReplSet } from './memory-replset';

const DATABASE_NAME = 'auth_e2e';

/** A database of the shared MongoDB test server, and the fixture's own connection to it. */
export async function startMongoE2eStorage(): Promise<E2eStorage> {
  const mongo = await startMemoryReplSet();
  const uri = mongo.uri(DATABASE_NAME);
  let fixtureConnection: Connection | undefined;

  return {
    environment: { MONGO_URI: uri },
    prepare: async (builder: TestingModuleBuilder): Promise<void> => {
      const { MONGOOSE_CONNECTION_OPTIONS } =
        await import('../../src/common/persistence/mongo/mongo-connection');
      // Own this connection so a failed compile cannot leave Nest retries running.
      fixtureConnection = await mongoose
        .createConnection(uri, { ...MONGOOSE_CONNECTION_OPTIONS })
        .asPromise();
      builder
        .overrideProvider(getConnectionToken())
        .useValue(fixtureConnection);
    },
    attach: async (app: INestApplication): Promise<AttachedE2eStorage> => {
      const connection = app.get<Connection>(getConnectionToken());
      const users = app.get<Model<UserDocument>>(getModelToken('User'));
      const { ApplicationRegistryService: RegistryService } =
        await import('../../src/session/persistence/mongo/application-registry.service');
      const applications = app.get(RegistryService);
      const applicationModel = app.get<Model<ApplicationDocument>>(
        getModelToken(Application.name),
      );
      const sessions = app.get<Model<SessionDocument>>(
        getModelToken(Session.name),
      );
      const seedAccounts = async (
        accounts: E2eAccountFixture[],
      ): Promise<void> => {
        await users.create(accounts);
      };
      return {
        state: {
          createApplication: async (application) => {
            await applicationModel.create(application);
          },
          seedAccounts,
          sessionIdWithPurpose: async (purpose) => {
            const session = await sessions
              .findOne({ credentialPurpose: purpose })
              .exec();
            return session ? session._id.toString() : null;
          },
        },
        empty: async () => {
          for (const collection of Object.values(connection.collections))
            await collection.deleteMany({});
        },
        seedApplications: async () => {
          await applications.seedFirstPartyApplications();
          await applications.ensureClientOriginAllowed();
        },
        seedAccounts,
      };
    },
    stop: async (): Promise<void> => {
      let failure: unknown;
      let failed = false;
      if (fixtureConnection) {
        try {
          await fixtureConnection.destroy(true);
        } catch (error) {
          failure = error;
          failed = true;
        }
        fixtureConnection = undefined;
      }
      try {
        await mongo.stop();
      } catch (error) {
        if (!failed) {
          failure = error;
          failed = true;
        }
      }
      if (failed) throw failure;
    },
  };
}
