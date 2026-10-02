import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
  MongooseModule,
  getConnectionToken,
  getModelToken,
} from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Connection, Model } from 'mongoose';
import { Clock } from '../../src/common/services/clock';
import { SessionService } from '../../src/auth/services/session.service';
import { SessionModule } from '../../src/session/session.module';
import {
  Session,
  SessionDocument,
} from '../../src/session/schemas/session.schema';
import {
  Application,
  ApplicationDocument,
} from '../../src/session/schemas/application.schema';
import {
  UserApplicationGrant,
  UserApplicationGrantDocument,
} from '../../src/session/schemas/user-application-grant.schema';
import { User, UserDocument } from '../../src/user/schemas/user.schema';
import { SessionAuthorityService } from '../../src/session/services/session-authority.service';
import { SessionRevocationService } from '../../src/session/services/session-revocation.service';
import { ApplicationAccessService } from '../../src/session/services/application-access.service';
import { FrozenClock } from './frozen-clock';

export const SESSION_AUTHORITY_BOOT_TIMEOUT_MS = 60000;

export interface SessionAuthorityHarness {
  app: INestApplication;
  clock: FrozenClock;
  sessionService: SessionService;
  authority: SessionAuthorityService;
  revocation: SessionRevocationService;
  applicationAccess: ApplicationAccessService;
  users: Model<UserDocument>;
  sessions: Model<SessionDocument>;
  applications: Model<ApplicationDocument>;
  grants: Model<UserApplicationGrantDocument>;
  connection: Connection;
}

export async function bootSessionAuthority(
  mongoUri: string,
  clock: FrozenClock,
): Promise<SessionAuthorityHarness> {
  const module: TestingModule = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        ignoreEnvFile: true,
        load: [
          () => ({
            auth: { epoch: 1, nativeEnabled: false, passwordEnabled: true },
            server: { nodeEnv: 'test' },
            cors: { clientUrl: 'http://localhost:3000' },
          }),
        ],
      }),
      MongooseModule.forRoot(mongoUri, {
        w: 'majority',
        retryWrites: true,
        readPreference: 'primary',
      }),
      SessionModule,
    ],
    providers: [SessionService],
  })
    .overrideProvider(Clock)
    .useValue(clock)
    .compile();

  const app = module.createNestApplication();
  await app.init();

  return {
    app,
    clock,
    sessionService: app.get(SessionService),
    authority: app.get(SessionAuthorityService),
    revocation: app.get(SessionRevocationService),
    applicationAccess: app.get(ApplicationAccessService),
    users: app.get<Model<UserDocument>>(getModelToken(User.name)),
    sessions: app.get<Model<SessionDocument>>(getModelToken(Session.name)),
    applications: app.get<Model<ApplicationDocument>>(
      getModelToken(Application.name),
    ),
    grants: app.get<Model<UserApplicationGrantDocument>>(
      getModelToken(UserApplicationGrant.name),
    ),
    connection: app.get(getConnectionToken()),
  };
}

export async function createTestUser(
  users: Model<UserDocument>,
  email: string,
): Promise<UserDocument> {
  return users.create({
    email,
    name: 'Session Tester',
    role: 'user',
    isVerified: true,
    sessionVersion: 0,
  });
}
