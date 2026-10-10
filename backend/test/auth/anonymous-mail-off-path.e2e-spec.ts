import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import type { Response } from 'supertest';
import * as bcrypt from 'bcrypt';
import { HashService } from '../../src/common/services/hash.service';
import { MailService } from '../../src/mail/mail.service';
import {
  User,
  UserDocument,
} from '../../src/user/persistence/mongo/schemas/user.schema';
import { PendingRegistration } from '../../src/auth/persistence/mongo/schemas/pending-registration.schema';
import { PENDING_PURPOSE } from '../../src/auth/constants/registration';
import { bootE2eApp, browserAgent, type E2eApp } from '../utils/e2e-app';
import { TEST_NOW } from '../utils/frozen-clock';
import {
  SESSION_AUTHORITY_BOOT_TIMEOUT_MS,
  SESSION_AUTHORITY_TEARDOWN_TIMEOUT_MS,
} from '../utils/session-authority-harness';

const CODE = '123456';
const LIVE_EXPIRY = new Date(TEST_NOW.getTime() + 15 * 60 * 1000);

/**
 * Each anonymous branch must do exactly one hash and answer without waiting
 * for the SMTP round trip. The mail send is held open here to prove it.
 */
describe('Anonymous mail is off the response path (e2e)', () => {
  let e2e: E2eApp;
  let users: Model<UserDocument>;
  let pendingRegistrations: Model<PendingRegistration>;
  let hashSpy: jest.SpyInstance;

  beforeAll(async () => {
    e2e = await bootE2eApp();
    users = e2e.app.get<Model<UserDocument>>(getModelToken(User.name));
    pendingRegistrations = e2e.app.get<Model<PendingRegistration>>(
      getModelToken('PendingRegistration'),
    );
  }, SESSION_AUTHORITY_BOOT_TIMEOUT_MS);

  beforeEach(async () => {
    e2e.clock.set(TEST_NOW);
    await e2e.reset();
    hashSpy = jest.spyOn(HashService.prototype, 'hash');
  });

  afterEach(async () => {
    await e2e.captureMail();
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await e2e?.close();
  }, SESSION_AUTHORITY_TEARDOWN_TIMEOUT_MS);

  async function post(
    path: string,
    body: Record<string, string>,
  ): Promise<Response> {
    const agent = await browserAgent(e2e.httpServer);
    return agent.post(path).send(body);
  }

  /**
   * Hold the mail send open, run the request, and assert the answer returned
   * while the send was still pending, with exactly one hash spent.
   */
  async function expectOffPath(
    request: () => Promise<Response>,
  ): Promise<void> {
    const mailService = e2e.app.get(MailService);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let settled = false;
    jest.spyOn(mailService, 'sendMail').mockImplementation(async () => {
      await gate;
      settled = true;
    });

    const response = await request();

    try {
      expect(response.status).toBe(200);
      expect(settled).toBe(false);
      expect(hashSpy).toHaveBeenCalledTimes(1);
    } finally {
      release();
      await e2e.captureMail();
    }

    expect(settled).toBe(true);
  }

  it('register for a free address hashes once and returns before the mail settles', async () => {
    await expectOffPath(() =>
      post('/api/auth/register', { email: 'free@example.test' }),
    );
  });

  it('register for a verified address hashes once and returns before the notice settles', async () => {
    await users.create({
      email: 'taken@example.test',
      name: 'Taken',
      isVerified: true,
    });

    await expectOffPath(() =>
      post('/api/auth/register', { email: 'taken@example.test' }),
    );
  });

  it('resend hashes once and returns before the mail settles', async () => {
    await pendingRegistrations.create({
      email: 'pending@example.test',
      purpose: PENDING_PURPOSE.SIGNUP,
      hashedCode: await bcrypt.hash(CODE, 4),
      attempts: 0,
      expiresAt: LIVE_EXPIRY,
    });

    await expectOffPath(() =>
      post('/api/auth/resend-activation', { email: 'pending@example.test' }),
    );
  });

  it('forgot-password for a known address hashes once and returns before the mail settles', async () => {
    await users.create({
      email: 'known@example.test',
      name: 'Known',
      isVerified: true,
      password: await bcrypt.hash('Password123!', 4),
    });

    await expectOffPath(() =>
      post('/api/auth/forgot-password', { email: 'known@example.test' }),
    );
  });
});
