import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
  MongooseModule,
  getConnectionToken,
  getModelToken,
} from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { Connection, Model } from 'mongoose';
import { Clock } from '../../src/common/services/clock';
import { SessionService } from '../../src/auth/services/session.service';
import { SessionModule } from '../../src/session/session.module';
import { NativeOAuthModule } from '../../src/session/native/native-oauth.module';
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

/** Jest hook budget for database startup and application boot under load. */
export const SESSION_AUTHORITY_BOOT_TIMEOUT_MS = 60000;

/** Jest hook budget for database teardown and application shutdown under load. */
export const SESSION_AUTHORITY_TEARDOWN_TIMEOUT_MS = 60000;

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
  options?: { nativeEnabled?: boolean; withNativeHttp?: boolean },
): Promise<SessionAuthorityHarness> {
  const module: TestingModule = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        ignoreEnvFile: true,
        load: [
          () => ({
            auth: {
              epoch: 1,
              nativeEnabled: options?.nativeEnabled ?? false,
              passwordEnabled: true,
            },
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
      ...(options?.withNativeHttp ? [NativeOAuthModule] : []),
    ],
    providers: [SessionService],
  })
    .overrideProvider(Clock)
    .useValue(clock)
    .compile();

  const app = module.createNestApplication();
  if (options?.withNativeHttp) {
    app.use(cookieParser());
    app.setGlobalPrefix('api');
  }
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
