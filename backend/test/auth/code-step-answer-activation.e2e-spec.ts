import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import type { Response } from 'supertest';
import * as bcrypt from 'bcrypt';
import { REQUEST_ID_HEADER } from '../../src/common/constants/request-id';
import { PendingRegistration } from '../../src/auth/schemas/pending-registration.schema';
import { bootE2eApp, browserAgent, type E2eApp } from '../utils/e2e-app';
import { TEST_NOW } from '../utils/frozen-clock';
import { RaceGate } from '../utils/race-gate';
import { expectSameAnswer } from '../utils/stable-answer';
import { mailedCode } from '../utils/pending-race';
import {
  SESSION_AUTHORITY_BOOT_TIMEOUT_MS,
  SESSION_AUTHORITY_TEARDOWN_TIMEOUT_MS,
} from '../utils/session-authority-harness';

const CODE = '123456';
const WRONG_CODE = '000000';
const MAX_ATTEMPTS = 5;
const LIVE_EXPIRY = new Date(TEST_NOW.getTime() + 15 * 60 * 1000);
const EXPIRED_EXPIRY = new Date(TEST_NOW.getTime() - 1000);

const ACTIVATION_BODY = {
  success: false,
  error: {
    code: 'ACTIVATION_CODE_INVALID',
    message: 'Invalid or expired activation code',
  },
} as const;

describe('Activation code step and pending registration windows (e2e)', () => {
  let e2e: E2eApp;
  let pendingRegistrations: Model<PendingRegistration>;

  beforeAll(async () => {
    e2e = await bootE2eApp();
    pendingRegistrations = e2e.app.get<Model<PendingRegistration>>(
      getModelToken('PendingRegistration'),
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

  function postWithId(
    path: string,
    body: Record<string, string>,
  ): Promise<Response> {
    return browserAgent(e2e.httpServer).then((agent) =>
      agent.post(path).set(REQUEST_ID_HEADER, 'code-step-request').send(body),
    );
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

  function passwordHash(record: { hashedPassword?: string }): string {
    if (!record.hashedPassword) {
      throw new Error('expected a stored password hash');
    }
    return record.hashedPassword;
  }

  function register(email: string, name: string, password: string) {
    return { email, password, name };
  }

  /** Start two registers, release the first, then the second, so it loses. */
  async function raceCreateFirstWins(
    first: () => Promise<Response>,
    second: () => Promise<Response>,
  ): Promise<[Response, Response]> {
    const firstGate = new RaceGate();
    const secondGate = new RaceGate();
    const originalCreate =
      pendingRegistrations.create.bind(pendingRegistrations);
    let call = 0;
    const spy = jest
      .spyOn(pendingRegistrations, 'create')
      .mockImplementation((...args) => {
        const gate = call === 0 ? firstGate : secondGate;
        call += 1;
        return gate.hold().then(() => originalCreate(...args));
      });

    try {
      const firstResponse = Promise.resolve(first());
      await firstGate.reached(1);
      const secondResponse = Promise.resolve(second());
      await secondGate.reached(1);
      firstGate.release();
      const firstResult = await firstResponse;
      secondGate.release();
      const secondResult = await secondResponse;
      return [firstResult, secondResult];
    } finally {
      spy.mockRestore();
    }
  }

  it('answers every failing activation code the same way', async () => {
    const noPending = await postWithId('/api/auth/activate', {
      email: 'activate-none@example.test',
      code: WRONG_CODE,
    });

    await seedPendingRegistration('activate-wrong@example.test');
    const wrong = await postWithId('/api/auth/activate', {
      email: 'activate-wrong@example.test',
      code: WRONG_CODE,
    });

    await seedPendingRegistration('activate-expired@example.test', {
      expiresAt: EXPIRED_EXPIRY,
    });
    const expired = await postWithId('/api/auth/activate', {
      email: 'activate-expired@example.test',
      code: CODE,
    });

    await seedPendingRegistration('activate-locked@example.test', {
      attempts: MAX_ATTEMPTS,
    });
    const locked = await postWithId('/api/auth/activate', {
      email: 'activate-locked@example.test',
      code: CODE,
    });

    expectSameAnswer(wrong, noPending);
    expectSameAnswer(expired, noPending);
    expectSameAnswer(locked, noPending);

    expect(noPending.status).toBe(400);
    expect(noPending.body).toEqual({
      ...ACTIVATION_BODY,
      requestId: 'code-step-request',
    });
  });

  it('still refuses the right activation code after the attempt limit, and stores why', async () => {
    const email = 'activate-limit@example.test';
    const hashedCode = await seedPendingRegistration(email);

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      await post('/api/auth/activate', { email, code: WRONG_CODE });
    }

    const refused = await post('/api/auth/activate', { email, code: CODE });
    expect(refused.status).toBe(400);
    expect(refused.body).toMatchObject(ACTIVATION_BODY);

    const record = await storedRegistration(email);
    expect(record.attempts).toBe(MAX_ATTEMPTS);
    expect(record.hashedCode).toBe(hashedCode);
  });

  it('keeps the winner name and password when a concurrent register loses the insert', async () => {
    const email = 'register-race@example.test';
    const firstAgent = await browserAgent(e2e.httpServer);
    const secondAgent = await browserAgent(e2e.httpServer);
    const firstBody = register(email, 'First User', 'FirstPassword123');
    const secondBody = register(email, 'Second User', 'SecondPassword123');

    const [first, second] = await raceCreateFirstWins(
      () => firstAgent.post('/api/auth/register').send(firstBody),
      () => secondAgent.post('/api/auth/register').send(secondBody),
    );

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.body).toEqual(second.body);
    expect(await pendingRegistrations.countDocuments({ email })).toBe(1);

    const record = await storedRegistration(email);
    expect(record.name).toBe('First User');
    expect(await bcrypt.compare('FirstPassword123', passwordHash(record))).toBe(
      true,
    );
    expect(
      await bcrypt.compare('SecondPassword123', passwordHash(record)),
    ).toBe(false);
    // The loser refreshed the code last, so the last mail is the live code.
    expect(await bcrypt.compare(mailedCode(e2e.mail), record.hashedCode)).toBe(
      true,
    );
  });
});
