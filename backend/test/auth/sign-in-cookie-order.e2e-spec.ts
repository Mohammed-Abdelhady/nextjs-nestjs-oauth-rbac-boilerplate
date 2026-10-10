import request from 'supertest';
import type { Response } from 'supertest';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { bootE2eApp, type E2eApp } from '../utils/e2e-app';
import { SEED_USER } from '../constants/seed-users';
import { CSRF_HEADER } from '../../src/session/constants/browser-proof';
import { Role } from '../../src/role/persistence/mongo/schemas/role.schema';
import { Session } from '../../src/session/persistence/mongo/schemas/session.schema';
import {
  SESSION_AUTHORITY_BOOT_TIMEOUT_MS,
  SESSION_AUTHORITY_TEARDOWN_TIMEOUT_MS,
} from '../utils/session-authority-harness';

describe('sign-in cookie ordering (e2e)', () => {
  let e2e: E2eApp;

  beforeAll(async () => {
    e2e = await bootE2eApp();
  }, SESSION_AUTHORITY_BOOT_TIMEOUT_MS);

  afterAll(async () => {
    await e2e?.close();
  }, SESSION_AUTHORITY_TEARDOWN_TIMEOUT_MS);

  it('answers a role lookup failure with no cookie and no session row', async () => {
    const roles = e2e.app.get<Model<Role>>(getModelToken(Role.name));
    const sessions = e2e.app.get<Model<Session>>(getModelToken(Session.name));
    const agent = request.agent(e2e.httpServer);
    const proof = await agent.get('/api/auth/browser-proof').expect(200);
    const preAuth = (proof.body as { data: { token: string } }).data.token;

    const spy = jest.spyOn(roles, 'findOne').mockImplementationOnce(() => {
      throw new Error('role read failed');
    });
    let response: Response;
    try {
      response = await agent
        .post('/api/auth/login')
        .set(CSRF_HEADER, preAuth)
        .send({ email: SEED_USER.email, password: SEED_USER.password });
    } finally {
      spy.mockRestore();
    }

    expect(response.status).toBe(500);
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(await sessions.countDocuments({})).toBe(0);
  });
});
