import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import type { Response } from 'supertest';
import * as bcrypt from 'bcrypt';
import { HashService } from '../../src/common/services/hash.service';
import { PendingRegistration } from '../../src/auth/schemas/pending-registration.schema';
import { bootE2eApp, browserAgent, type E2eApp } from '../utils/e2e-app';
import { TEST_NOW } from '../utils/frozen-clock';
import { inWindow, mailedCode, pauseQueryCall } from '../utils/pending-race';
import {
  SESSION_AUTHORITY_BOOT_TIMEOUT_MS,
  SESSION_AUTHORITY_TEARDOWN_TIMEOUT_MS,
} from '../utils/session-authority-harness';

const CODE = '123456';
const LIVE_EXPIRY = new Date(TEST_NOW.getTime() + 15 * 60 * 1000);
const EXPIRED_EXPIRY = new Date(TEST_NOW.getTime() - 1000);

const ACTIVATION_BODY = {
  success: false,
  error: {
    code: 'ACTIVATION_CODE_INVALID',
    message: 'Invalid or expired activation code',
  },
} as const;

describe('Resend and expired cleanup windows (e2e)', () => {
  let e2e: E2eApp;
  let pendingRegistrations: Model<PendingRegistration>;
  let hashService: HashService;

  beforeAll(async () => {
    e2e = await bootE2eApp();
    pendingRegistrations = e2e.app.get<Model<PendingRegistration>>(
      getModelToken('PendingRegistration'),
    );
    hashService = e2e.app.get(HashService);
  }, SESSION_AUTHORITY_BOOT_TIMEOUT_MS);

  beforeEach(async () => {
    e2e.clock.set(TEST_NOW);
    await e2e.reset();
  });

  afterEach(() => {
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

  async function seedPendingRegistration(
    email: string,
    overrides: Record<string, unknown> = {},
  ): Promise<string> {
    const hashedCode = await bcrypt.hash(CODE, 4);
    await pendingRegistrations.create({
      email,
      name: 'Pending Account',
      hashedCode,
      attempts: 0,
      expiresAt: LIVE_EXPIRY,
      ...overrides,
    });
    return hashedCode;
  }

  async function storedRegistration(email: string) {
    const record = await pendingRegistrations
      .findOne({ email })
      .select('+hashedPassword +hashedCode');
    if (!record) throw new Error(`expected a stored record for ${email}`);
    return record;
  }

  it('answers resend with the normal success when an activate consumes the record during the hash', async () => {
    const email = 'resend-consumed@example.test';
    await seedPendingRegistration(email);

    const response = await inWindow(
      (gate) => {
        const originalHash = hashService.hash.bind(hashService);
        const spy = jest
          .spyOn(HashService.prototype, 'hash')
          .mockImplementation(async (plain: string): Promise<string> => {
            if (/^\d{6}$/.test(plain)) await gate.hold();
            return originalHash(plain);
          });
        return () => spy.mockRestore();
      },
      () => post('/api/auth/resend-activation', { email }),
      () => pendingRegistrations.deleteOne({ email }),
    );

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ success: true, data: { email } });
    expect(e2e.mail).toHaveLength(0);
    expect(await pendingRegistrations.countDocuments({ email })).toBe(0);
  });

  it('keeps the replaced details when a register replaces the record during a resend', async () => {
    const email = 'resend-replaced@example.test';
    const replacedPassword = await bcrypt.hash('replaced-password', 4);
    await seedPendingRegistration(email, {
      name: 'Old Name',
      hashedPassword: await bcrypt.hash('old-password', 4),
      expiresAt: EXPIRED_EXPIRY,
    });

    const response = await inWindow(
      (gate) => {
        const originalHash = hashService.hash.bind(hashService);
        const spy = jest
          .spyOn(HashService.prototype, 'hash')
          .mockImplementation(async (plain: string): Promise<string> => {
            if (/^\d{6}$/.test(plain)) await gate.hold();
            return originalHash(plain);
          });
        return () => spy.mockRestore();
      },
      () => post('/api/auth/resend-activation', { email }),
      async () =>
        pendingRegistrations.updateOne(
          { email },
          {
            $set: {
              name: 'Replaced Name',
              hashedPassword: replacedPassword,
              hashedCode: await bcrypt.hash('654321', 4),
              attempts: 0,
              expiresAt: LIVE_EXPIRY,
            },
          },
        ),
    );

    expect(response.status).toBe(200);
    expect(e2e.mail).toHaveLength(1);
    const record = await storedRegistration(email);
    expect(record.name).toBe('Replaced Name');
    expect(record.hashedPassword).toBe(replacedPassword);
    expect(await bcrypt.compare(mailedCode(e2e.mail), record.hashedCode)).toBe(
      true,
    );
  });

  it('does not delete a replaced record when the expired cleanup runs', async () => {
    const email = 'stale-delete@example.test';
    const replacedPassword = await bcrypt.hash('replaced-password', 4);
    await seedPendingRegistration(email, {
      name: 'Old Name',
      hashedPassword: await bcrypt.hash('old-password', 4),
      expiresAt: EXPIRED_EXPIRY,
    });

    const response = await inWindow(
      (gate) => pauseQueryCall(pendingRegistrations, 'deleteOne', gate, 0),
      () => post('/api/auth/activate', { email, code: CODE }),
      async () =>
        pendingRegistrations.updateOne(
          { email },
          {
            $set: {
              name: 'Replaced Name',
              hashedPassword: replacedPassword,
              hashedCode: await bcrypt.hash('654321', 4),
              attempts: 0,
              expiresAt: LIVE_EXPIRY,
            },
          },
        ),
    );

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject(ACTIVATION_BODY);
    expect(await pendingRegistrations.countDocuments({ email })).toBe(1);
    const record = await storedRegistration(email);
    expect(record.name).toBe('Replaced Name');
    expect(record.hashedPassword).toBe(replacedPassword);
    expect(await bcrypt.compare('654321', record.hashedCode)).toBe(true);
  });
});
