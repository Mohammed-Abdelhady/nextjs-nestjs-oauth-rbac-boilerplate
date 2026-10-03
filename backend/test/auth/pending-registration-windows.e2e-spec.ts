import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import type { Response } from 'supertest';
import * as bcrypt from 'bcrypt';
import { PendingRegistration } from '../../src/auth/schemas/pending-registration.schema';
import { MailCounter } from '../../src/auth/schemas/mail-counter.schema';
import {
  MAIL_COUNTER_PURPOSE,
  PENDING_PURPOSE,
} from '../../src/auth/constants/registration';
import { bootE2eApp, browserAgent, type E2eApp } from '../utils/e2e-app';
import { TEST_NOW } from '../utils/frozen-clock';
import { RaceGate } from '../utils/race-gate';
import {
  inWindow,
  pauseCreateCall,
  pauseQueryCall,
} from '../utils/pending-race';
import {
  SESSION_AUTHORITY_BOOT_TIMEOUT_MS,
  SESSION_AUTHORITY_TEARDOWN_TIMEOUT_MS,
} from '../utils/session-authority-harness';

const CODE = '123456';
const LIVE_EXPIRY = new Date(TEST_NOW.getTime() + 15 * 60 * 1000);
const EXPIRED_EXPIRY = new Date(TEST_NOW.getTime() - 1000);

describe('Pending registration windows (e2e)', () => {
  let e2e: E2eApp;
  let pendingRegistrations: Model<PendingRegistration>;
  let mailCounters: Model<MailCounter>;

  beforeAll(async () => {
    e2e = await bootE2eApp();
    pendingRegistrations = e2e.app.get<Model<PendingRegistration>>(
      getModelToken('PendingRegistration'),
    );
    mailCounters = e2e.app.get<Model<MailCounter>>(
      getModelToken('MailCounter'),
    );
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

  function pendingFields(overrides: Record<string, unknown> = {}) {
    return {
      purpose: PENDING_PURPOSE.SIGNUP,
      hashedCode: 'old-code',
      attempts: 0,
      expiresAt: LIVE_EXPIRY,
      ...overrides,
    };
  }

  async function seedPendingRegistration(
    email: string,
    overrides: Record<string, unknown> = {},
  ): Promise<string> {
    const hashedCode = await bcrypt.hash(CODE, 4);
    await pendingRegistrations.create({
      email,
      ...pendingFields({ hashedCode, ...overrides }),
    });
    return hashedCode;
  }

  async function storedRegistration(email: string) {
    const record = await pendingRegistrations
      .findOne({ email })
      .select('+hashedCode');
    if (!record) throw new Error(`expected a stored record for ${email}`);
    return record;
  }

  it('recreates the registration when it is deleted between the live refresh and the expired replace', async () => {
    const email = 'window-replace@example.test';
    await seedPendingRegistration(email, { expiresAt: EXPIRED_EXPIRY });

    const response = await inWindow(
      (gate) =>
        pauseQueryCall(pendingRegistrations, 'findOneAndUpdate', gate, 1),
      () => post('/api/auth/register', { email }),
      () => pendingRegistrations.deleteOne({ email }),
    );

    expect(response.status).toBe(200);
    expect(await pendingRegistrations.countDocuments({ email })).toBe(1);
    const record = await storedRegistration(email);
    expect(record.purpose).toBe(PENDING_PURPOSE.SIGNUP);
    expect(
      await bcrypt.compare(await e2e.mailedCode(), record.hashedCode),
    ).toBe(true);
  });

  it('refreshes a record inserted between the replace and the create', async () => {
    const email = 'window-create@example.test';

    const response = await inWindow(
      (gate) => pauseCreateCall(pendingRegistrations, gate, 0),
      () => post('/api/auth/register', { email }),
      () =>
        pendingRegistrations.create({
          email,
          ...pendingFields({
            hashedCode: 'inserted-code',
          }),
        }),
    );

    expect(response.status).toBe(200);
    expect(await pendingRegistrations.countDocuments({ email })).toBe(1);
    const record = await storedRegistration(email);
    expect(record.purpose).toBe(PENDING_PURPOSE.SIGNUP);
    const counter = await mailCounters.findOne({
      email,
      purpose: MAIL_COUNTER_PURPOSE.SIGNUP,
    });
    expect(counter?.mailedCodes).toBe(1);
    expect(
      await bcrypt.compare(await e2e.mailedCode(), record.hashedCode),
    ).toBe(true);
  });

  it('recreates the registration when the winner is deleted after the duplicate key', async () => {
    const email = 'window-retry@example.test';
    const firstAgent = await browserAgent(e2e.httpServer);
    const secondAgent = await browserAgent(e2e.httpServer);

    const firstGate = new RaceGate();
    const secondGate = new RaceGate();
    const retryGate = new RaceGate();
    const originalCreate =
      pendingRegistrations.create.bind(pendingRegistrations);
    let createCall = 0;
    const createSpy = jest
      .spyOn(pendingRegistrations, 'create')
      .mockImplementation((...args) => {
        const gate = createCall === 0 ? firstGate : secondGate;
        createCall += 1;
        return gate.hold().then(() => originalCreate(...args));
      });
    // The loser's second pass reaches this live refresh (call 4) after its
    // create lost the unique index.
    const restoreQuery = pauseQueryCall(
      pendingRegistrations,
      'findOneAndUpdate',
      retryGate,
      4,
    );

    try {
      const first = Promise.resolve(
        firstAgent.post('/api/auth/register').send({ email }),
      );
      await firstGate.reached(1);
      const second = Promise.resolve(
        secondAgent.post('/api/auth/register').send({ email }),
      );
      await secondGate.reached(1);

      firstGate.release();
      const firstResult = await first;
      secondGate.release();
      await retryGate.reached(1);
      await pendingRegistrations.deleteOne({ email });
      retryGate.release();
      const secondResult = await second;

      expect([firstResult.status, secondResult.status]).toEqual([200, 200]);
    } finally {
      createSpy.mockRestore();
      restoreQuery();
    }

    expect(await pendingRegistrations.countDocuments({ email })).toBe(1);
    const record = await storedRegistration(email);
    expect(record.purpose).toBe(PENDING_PURPOSE.SIGNUP);
    expect(
      await bcrypt.compare(await e2e.mailedCode(), record.hashedCode),
    ).toBe(true);
  });
});
