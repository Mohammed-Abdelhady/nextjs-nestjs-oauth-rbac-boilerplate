import { INestApplication, ValidationPipe } from '@nestjs/common';
import type { Server } from 'node:http';
import { mkdtemp, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Test } from '@nestjs/testing';
import { getStorageToken, ThrottlerStorageService } from '@nestjs/throttler';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { startMemoryReplSet } from './memory-replset';
import { Connection, Model } from 'mongoose';
import { useContainer } from 'class-validator';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import * as bcrypt from 'bcrypt';
import { CSRF_HEADER } from '../../src/session/constants/browser-proof';
import request from 'supertest';
import { browserCors } from '../../src/common/security/browser-cors';
import { DEVELOPMENT_CONTENT_SECURITY_POLICY } from '../../src/common/security/content-security-policy';
import { Clock } from '../../src/common/services/clock';
import {
  SeedUser,
  SEED_ADMIN,
  SEED_MANAGER,
  SEED_SUPPORT,
  SEED_USER,
} from '../constants/seed-users';
import type { UserDocument } from '../../src/user/schemas/user.schema';
import type { OAuthProviderStrategy } from '../../src/auth/oauth/oauth-provider.interface'; // feature:oauth-core
import { OAUTH_STRATEGIES } from '../../src/auth/oauth/oauth.constants'; // feature:oauth-core
import type { MailOptions } from '../../src/mail/interfaces/mail-options.interface';
import { FrozenClock, TEST_NOW } from './frozen-clock';

export type HttpServer = Server;
export type TestAgent = ReturnType<typeof request.agent>;
export const E2E_CLIENT_URL = 'http://127.0.0.1:3107';

export interface E2eApp {
  app: INestApplication;
  httpServer: HttpServer;
  mail: MailOptions[];
  clock: FrozenClock;
  reset: () => Promise<void>;
  close: () => Promise<void>;
}

/** Optional overrides for a booted fixture. A feature's option never shifts another. */
export interface BootE2eAppOptions {
  nodeEnv?: string;
  browserStrategy?: OAuthProviderStrategy; // feature:oauth-core
  magicLinkEnabled?: boolean; // feature:magic-link
  /** The mail array records attempts, including the rejected ones. */
  failMail?: boolean;
}

/** Owns its database and starts configuration outside the developer's env directory. */
export async function bootE2eApp(
  port = 0,
  options: BootE2eAppOptions = {},
): Promise<E2eApp> {
  const nodeEnv = options.nodeEnv ?? 'test';
  const browserStrategy = options.browserStrategy; // feature:oauth-core
  const failMail = options.failMail === true;
  const originalDirectory = process.cwd();
  const fixtureDirectory = await mkdtemp(join(tmpdir(), 'auth-e2e-'));
  const mongo = await startMemoryReplSet().catch(async (error: unknown) => {
    await rmdir(fixtureDirectory);
    throw error;
  });
  const environment = {
    OAUTH_STATE_SECRET: 'local-fixture-state-secret-000000000000',
    NODE_ENV: nodeEnv,
    MONGO_URI: mongo.uri('auth_e2e'),
    CLIENT_URL: E2E_CLIENT_URL,
    API_URL: 'http://127.0.0.1:5107',
    PORT: '5107',
    BCRYPT_ROUNDS: '4',
    THROTTLE_LIMIT: '1000',
    AUTH_PASSWORD_ENABLED: 'true',
    MAGIC_LINK_ENABLED: 'false',
    OAUTH_CALLBACK_BASE_URL: 'http://127.0.0.1:5107/api/auth/oauth',
    SMTP_HOST: '127.0.0.1',
    SMTP_PORT: '1',
    EMAIL_FROM: 'fixture@example.test',
  };
  // feature:oauth-core:start
  if (browserStrategy) environment.MAGIC_LINK_ENABLED = 'true';
  // feature:oauth-core:end
  // feature:magic-link:start
  if (options.magicLinkEnabled) environment.MAGIC_LINK_ENABLED = 'true';
  // feature:magic-link:end
  const previous = new Map(
    Object.keys(environment).map((key) => [key, process.env[key]]),
  );
  Object.assign(process.env, environment);
  process.chdir(fixtureDirectory);
  const clock = new FrozenClock(TEST_NOW);
  let app: INestApplication | undefined;
  let closed = false;
  const close = async (): Promise<void> => {
    if (closed) return;
    closed = true;
    try {
      await app?.close();
    } finally {
      try {
        await mongo.stop();
      } finally {
        process.chdir(originalDirectory);
        for (const [key, value] of previous) {
          if (value === undefined) delete process.env[key];
          else process.env[key] = value;
        }
        await rmdir(fixtureDirectory);
      }
    }
  };

  try {
    const { AppModule } = await import('../../src/app.module');
    const { MailService } = await import('../../src/mail/mail.service');
    const { RoleSeedService } =
      await import('../../src/database/seeds/role.seed');
    const { ApplicationRegistryService } =
      await import('../../src/session/services/application-registry.service');
    const { SEED_USER_DEFINITIONS } =
      await import('../../src/database/seeds/user.seed');
    const mail: MailOptions[] = [];
    const builder = Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MailService)
      .useFactory({
        factory: () => {
          const service = Object.create(MailService.prototype) as InstanceType<
            typeof MailService
          >;
          service.sendMail = (options: MailOptions): Promise<void> => {
            mail.push(options);
            if (failMail) {
              return Promise.reject(new Error('mail delivery failed in test'));
            }
            return Promise.resolve();
          };
          return service;
        },
      });
    builder.overrideProvider(Clock).useValue(clock);
    // feature:oauth-core:start
    if (browserStrategy)
      builder.overrideProvider(OAUTH_STRATEGIES).useValue([browserStrategy]);
    // feature:oauth-core:end
    const moduleFixture = await builder.compile();
    app = moduleFixture.createNestApplication({ logger: ['error', 'warn'] });
    useContainer(app.select(AppModule), { fallbackOnErrors: true });
    app.setGlobalPrefix('api', { exclude: ['health'] });
    app.use(
      helmet({
        contentSecurityPolicy: DEVELOPMENT_CONTENT_SECURITY_POLICY,
        crossOriginEmbedderPolicy: false,
      }),
    );
    app.use(cookieParser());
    app.enableCors(browserCors(environment.CLIENT_URL));
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.listen(port, '127.0.0.1');
    const connection = app.get<Connection>(getConnectionToken());
    const users = app.get<Model<UserDocument>>(getModelToken('User'));
    const roleSeed =
      app.get<InstanceType<typeof RoleSeedService>>(RoleSeedService);
    const applications = app.get(ApplicationRegistryService);
    const credentials = [SEED_ADMIN, SEED_MANAGER, SEED_SUPPORT, SEED_USER];
    const fixtures = await Promise.all(
      SEED_USER_DEFINITIONS.map(async (user) => ({
        ...user,
        permissions: [...user.permissions],
        isVerified: true,
        password: await bcrypt.hash(
          credentials.find((item) => item.email === user.email)!.password,
          4,
        ),
      })),
    );
    const throttleStorage = app.get<ThrottlerStorageService>(getStorageToken());
    const reset = async (): Promise<void> => {
      throttleStorage.onApplicationShutdown();
      throttleStorage.storage.clear();
      for (const collection of Object.values(connection.collections))
        await collection.deleteMany({});
      await roleSeed.seed();
      await applications.seedFirstPartyApplications();
      await applications.ensureClientOriginAllowed();
      await users.create(fixtures);
      mail.length = 0;
    };
    await reset();
    return {
      app,
      httpServer: app.getHttpServer() as Server,
      mail,
      clock,
      reset,
      close,
    };
  } catch (error) {
    await close();
    throw error;
  }
}

/** Returns an agent with a session issued by the real password login route. */
export async function loginAs(
  httpServer: HttpServer,
  user: SeedUser,
): Promise<TestAgent> {
  const agent = request.agent(httpServer);
  const proof = await agent.get('/api/auth/browser-proof').expect(200);
  const preAuth = (proof.body as { data: { token: string } }).data.token;
  const login = await agent
    .post('/api/auth/login')
    .set(CSRF_HEADER, preAuth)
    .send({ email: user.email, password: user.password })
    .expect(200);
  return bindBrowserProof(agent, headerToken(login));
}

export async function browserAgent(httpServer: HttpServer): Promise<TestAgent> {
  const agent = request.agent(httpServer);
  const proof = await agent.get('/api/auth/browser-proof').expect(200);
  const token = (proof.body as { data: { token: string } }).data.token;
  return bindBrowserProof(agent, token);
}

function headerToken(response: { headers: Record<string, unknown> }): string {
  const value = response.headers[CSRF_HEADER];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('login did not return a browser proof');
  }
  return value;
}

function bindBrowserProof(agent: TestAgent, token: string): TestAgent {
  const methods = ['post', 'put', 'patch', 'delete'] as const;
  for (const method of methods) {
    const original = agent[method].bind(agent);
    agent[method] = (url: string) => original(url).set(CSRF_HEADER, token);
  }
  return agent;
}
