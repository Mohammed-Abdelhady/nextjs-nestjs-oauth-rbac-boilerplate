import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import type { Response } from 'supertest';
import * as bcrypt from 'bcrypt';
import { REQUEST_ID_HEADER } from '../../src/common/constants/request-id';
import { PendingPasswordReset } from '../../src/auth/persistence/mongo/schemas/pending-password-reset.schema';
import type { UserDocument } from '../../src/user/persistence/mongo/schemas/user.schema';
import { bootE2eApp, browserAgent, type E2eApp } from '../utils/e2e-app';
import { TEST_NOW } from '../utils/frozen-clock';
import { RaceGate } from '../utils/race-gate';
import { expectSameAnswer } from '../utils/stable-answer';
import { holdStoreCall, inWindow } from '../utils/pending-race';
import { PasswordResetCodeStore } from '../../src/auth/pending-codes/password-reset-code.store';
import {
  SESSION_AUTHORITY_BOOT_TIMEOUT_MS,
  SESSION_AUTHORITY_TEARDOWN_TIMEOUT_MS,
} from '../utils/session-authority-harness';

const PASSWORD = 'Password123!';
const CODE = '123456';
const WRONG_CODE = '000000';
const MAX_ATTEMPTS = 5;
const LIVE_EXPIRY = new Date(TEST_NOW.getTime() + 15 * 60 * 1000);
const EXPIRED_EXPIRY = new Date(TEST_NOW.getTime() - 1000);

const RESET_BODY = {
  success: false,
  error: {
    code: 'PASSWORD_RESET_CODE_INVALID',
    message: 'Invalid or expired password reset code',
  },
} as const;

describe('Password reset code step and pending reset windows (e2e)', () => {
  let e2e: E2eApp;
  let users: Model<UserDocument>;
  let pendingPasswordResets: Model<PendingPasswordReset>;
  let resetStore: PasswordResetCodeStore;

  beforeAll(async () => {
    e2e = await bootE2eApp();
    users = e2e.app.get<Model<UserDocument>>(getModelToken('User'));
    resetStore = e2e.app.get(PasswordResetCodeStore);
    pendingPasswordResets = e2e.app.get<Model<PendingPasswordReset>>(
      getModelToken('PendingPasswordReset'),
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

  async function seedPendingPasswordReset(
    email: string,
    overrides: Record<string, unknown> = {},
  ): Promise<void> {
    await pendingPasswordResets.create({
      email,
      hashedCode: await bcrypt.hash(CODE, 4),
      attempts: 0,
      expiresAt: LIVE_EXPIRY,
      ...overrides,
    });
  }

  async function storedReset(email: string) {
    const record = await pendingPasswordResets
      .findOne({ email })
      .select('+hashedCode');
    if (!record) throw new Error(`expected a stored record for ${email}`);
    return record;
  }

  function createVerifiedAccount(email: string): Promise<unknown> {
    return users.create({ email, name: 'Existing Account', isVerified: true });
  }

  /** Start two forgot-password writes, release the first, then the second. */
  async function raceCreateFirstWins(
    first: () => Promise<Response>,
    second: () => Promise<Response>,
  ): Promise<[Response, Response]> {
    const firstGate = new RaceGate();
    const secondGate = new RaceGate();
    const originalCreate = pendingPasswordResets.create.bind(
      pendingPasswordResets,
    );
    let call = 0;
    const spy = jest
      .spyOn(pendingPasswordResets, 'create')
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

  it('answers every failing password reset code the same way', async () => {
    const noPending = await postWithId('/api/auth/reset-password', {
      email: 'reset-none@example.test',
      code: WRONG_CODE,
      newPassword: PASSWORD,
    });

    await seedPendingPasswordReset('reset-wrong@example.test');
    const wrong = await postWithId('/api/auth/reset-password', {
      email: 'reset-wrong@example.test',
      code: WRONG_CODE,
      newPassword: PASSWORD,
    });

    await seedPendingPasswordReset('reset-expired@example.test', {
      expiresAt: EXPIRED_EXPIRY,
    });
    const expired = await postWithId('/api/auth/reset-password', {
      email: 'reset-expired@example.test',
      code: CODE,
      newPassword: PASSWORD,
    });

    await seedPendingPasswordReset('reset-locked@example.test', {
      attempts: MAX_ATTEMPTS,
    });
    const locked = await postWithId('/api/auth/reset-password', {
      email: 'reset-locked@example.test',
      code: CODE,
      newPassword: PASSWORD,
    });

    expectSameAnswer(wrong, noPending);
    expectSameAnswer(expired, noPending);
    expectSameAnswer(locked, noPending);

    expect(noPending.status).toBe(400);
    expect(noPending.body).toEqual({
      ...RESET_BODY,
      requestId: 'code-step-request',
    });
  });

  it('still refuses the right password reset code after the attempt limit, and stores why', async () => {
    const email = 'reset-limit@example.test';
    await seedPendingPasswordReset(email);

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      await post('/api/auth/reset-password', {
        email,
        code: WRONG_CODE,
        newPassword: PASSWORD,
      });
    }

    const refused = await post('/api/auth/reset-password', {
      email,
      code: CODE,
      newPassword: PASSWORD,
    });
    expect(refused.status).toBe(400);
    expect(refused.body).toMatchObject(RESET_BODY);

    const record = await storedReset(email);
    expect(record.attempts).toBe(MAX_ATTEMPTS);
  });

  it('answers two forgot-password requests at once for a known address with one record', async () => {
    const email = 'forgot-race@example.test';
    await createVerifiedAccount(email);
    const firstAgent = await browserAgent(e2e.httpServer);
    const secondAgent = await browserAgent(e2e.httpServer);

    const [first, second] = await raceCreateFirstWins(
      () => firstAgent.post('/api/auth/forgot-password').send({ email }),
      () => secondAgent.post('/api/auth/forgot-password').send({ email }),
    );

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.body).toEqual(second.body);
    expect(await pendingPasswordResets.countDocuments({ email })).toBe(1);

    const record = await storedReset(email);
    // The loser updated the code last, so the last mail is the live code.
    expect(
      await bcrypt.compare(await e2e.mailedCode(), record.hashedCode),
    ).toBe(true);
  });

  it('updates a record inserted between the update and the create', async () => {
    const email = 'reset-window-create@example.test';
    await createVerifiedAccount(email);

    const response = await inWindow(
      (gate) => holdStoreCall(resetStore, 'insertRecord', gate, 0),
      () => post('/api/auth/forgot-password', { email }),
      async () =>
        pendingPasswordResets.create({
          email,
          hashedCode: await bcrypt.hash('654321', 4),
          attempts: 0,
          expiresAt: LIVE_EXPIRY,
        }),
    );

    expect(response.status).toBe(200);
    expect(await pendingPasswordResets.countDocuments({ email })).toBe(1);
    const record = await storedReset(email);
    expect(
      await bcrypt.compare(await e2e.mailedCode(), record.hashedCode),
    ).toBe(true);
  });

  it('recreates the reset when the winner is deleted after the duplicate key', async () => {
    const email = 'reset-window-retry@example.test';
    await createVerifiedAccount(email);
    const firstAgent = await browserAgent(e2e.httpServer);
    const secondAgent = await browserAgent(e2e.httpServer);

    const firstGate = new RaceGate();
    const secondGate = new RaceGate();
    const retryGate = new RaceGate();
    const originalCreate = pendingPasswordResets.create.bind(
      pendingPasswordResets,
    );
    let createCall = 0;
    const createSpy = jest
      .spyOn(pendingPasswordResets, 'create')
      .mockImplementation((...args) => {
        const gate = createCall === 0 ? firstGate : secondGate;
        createCall += 1;
        return gate.hold().then(() => originalCreate(...args));
      });
    // Both first updates ran before the creates; the loser's second pass
    // reaches update call 2 after its create lost the unique index.
    const restoreQuery = holdStoreCall(resetStore, 'rotateCode', retryGate, 2);

    let firstResult: Response;
    let secondResult: Response;
    try {
      const first = Promise.resolve(
        firstAgent.post('/api/auth/forgot-password').send({ email }),
      );
      await firstGate.reached(1);
      const second = Promise.resolve(
        secondAgent.post('/api/auth/forgot-password').send({ email }),
      );
      await secondGate.reached(1);

      firstGate.release();
      firstResult = await first;
      secondGate.release();
      await retryGate.reached(1);
      await pendingPasswordResets.deleteOne({ email });
      retryGate.release();
      secondResult = await second;

      expect([firstResult.status, secondResult.status]).toEqual([200, 200]);
    } finally {
      createSpy.mockRestore();
      restoreQuery();
    }

    expect(await pendingPasswordResets.countDocuments({ email })).toBe(1);
    const record = await storedReset(email);
    expect(
      await bcrypt.compare(await e2e.mailedCode(), record.hashedCode),
    ).toBe(true);
  });

  it('does not delete a replaced reset when the expired cleanup runs', async () => {
    const email = 'reset-stale-delete@example.test';
    await seedPendingPasswordReset(email, { expiresAt: EXPIRED_EXPIRY });

    const response = await inWindow(
      (gate) => holdStoreCall(resetStore, 'dropExpiredRecord', gate, 0),
      () =>
        post('/api/auth/reset-password', {
          email,
          code: CODE,
          newPassword: PASSWORD,
        }),
      async () =>
        pendingPasswordResets.updateOne(
          { email },
          {
            $set: {
              hashedCode: await bcrypt.hash('654321', 4),
              attempts: 0,
              expiresAt: LIVE_EXPIRY,
            },
          },
        ),
    );

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject(RESET_BODY);
    expect(await pendingPasswordResets.countDocuments({ email })).toBe(1);
    const record = await storedReset(email);
    expect(await bcrypt.compare('654321', record.hashedCode)).toBe(true);
  });
});
