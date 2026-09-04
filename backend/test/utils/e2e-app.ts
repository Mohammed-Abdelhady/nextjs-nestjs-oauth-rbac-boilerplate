import { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { SeedUser } from '../constants/seed-users';

export type HttpServer = Server;
export type TestAgent = ReturnType<typeof request.agent>;

export interface E2eApp {
  app: INestApplication;
  httpServer: HttpServer;
}

/**
 * Boots the whole AppModule against the MONGO_URI of the environment, with the
 * same route prefix as main.ts. Needs a reachable MongoDB and a seeded
 * database.
 */
export async function bootE2eApp(): Promise<E2eApp> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  app.setGlobalPrefix('api', { exclude: ['health'] });
  await app.init();

  return { app, httpServer: app.getHttpServer() as Server };
}

/** Returns an agent that keeps the session cookie of the given seed user. */
export async function loginAs(
  httpServer: HttpServer,
  user: SeedUser,
): Promise<TestAgent> {
  const agent = request.agent(httpServer);

  await agent
    .post('/api/auth/login')
    .send({ email: user.email, password: user.password })
    .expect(200);

  return agent;
}
