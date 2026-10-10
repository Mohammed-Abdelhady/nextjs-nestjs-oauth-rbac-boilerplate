import { getModelToken } from '@nestjs/mongoose';
import { Logger } from '@nestjs/common';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import { ClientSession, MongoNetworkError } from 'mongodb';
import type { Response } from 'supertest';
import * as bcrypt from 'bcrypt';
import { User } from '../../src/user/persistence/mongo/schemas/user.schema';
import type { UserDocument } from '../../src/user/persistence/mongo/schemas/user.schema';
import { PendingRegistration } from '../../src/auth/persistence/mongo/schemas/pending-registration.schema';
import { PENDING_PURPOSE } from '../../src/auth/constants/registration';
import { ErrorCode } from '../../src/common/enums/error-code.enum';
import { bootE2eApp, browserAgent, type E2eApp } from '../utils/e2e-app';
import { TEST_NOW } from '../utils/frozen-clock';
import { RaceGate } from '../utils/race-gate';
import {
  SESSION_AUTHORITY_BOOT_TIMEOUT_MS,
  SESSION_AUTHORITY_TEARDOWN_TIMEOUT_MS,
} from '../utils/session-authority-harness';

const CODE = '123456';
const PASSWORD = 'Password123!';
const NAME = 'Test User';
const LIVE_EXPIRY = new Date(TEST_NOW.getTime() + 15 * 60 * 1000);

/** Original driver method, before test spies are installed. */
const realCommitTransaction = (
  ClientSession.prototype as {
    commitTransaction: (this: ClientSession) => Promise<void>;
  }
).commitTransaction;

/**
 * The driver's commit result is unknown to the server: it may have landed or
 * not. These cases force that boundary and check what the server answers.
 */
describe('Activation unknown commit outcomes (e2e)', () => {
  let e2e: E2eApp;
  let users: Model<UserDocument>;
  let pendingRegistrations: Model<PendingRegistration>;

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

  function expectUnknownOutcome(response: Response): void {
    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe(
      ErrorCode.TRANSACTION_OUTCOME_UNKNOWN,
    );
  }

  function activationBody(
    email: string,
    code: string,
    password: string,
  ): Record<string, string> {
    return { email, code, password, name: NAME };
  }

  async function seedSignup(email: string): Promise<void> {
    await pendingRegistrations.create({
      email,
      purpose: PENDING_PURPOSE.SIGNUP,
      hashedCode: await bcrypt.hash(CODE, 4),
      attempts: 0,
      expiresAt: LIVE_EXPIRY,
    });
  }

  async function seedEmailChange(
    email: string,
    generation: number,
  ): Promise<UserDocument> {
    const target = await users.create({
      email,
      name: 'Target',
      isVerified: false,
      addressGeneration: generation,
    });
    await pendingRegistrations.create({
      email,
      purpose: PENDING_PURPOSE.EMAIL_CHANGE,
      hashedCode: await bcrypt.hash(CODE, 4),
      attempts: 0,
      expiresAt: LIVE_EXPIRY,
      userId: new Types.ObjectId(target._id),
      addressGeneration: generation,
    });
    return target;
  }

  /** Inject an ambiguous commit answer, optionally after the actual commit. */
  function unknownCommit(
    lands: boolean,
    unlabelledNetworkError = false,
  ): jest.SpyInstance {
    const failure = () =>
      unlabelledNetworkError
        ? new MongoNetworkError('connection closed after commit')
        : Object.assign(new Error('unknown commit'), {
            errorLabels: ['UnknownTransactionCommitResult'],
          });
    if (!lands) {
      return jest
        .spyOn(ClientSession.prototype, 'commitTransaction')
        .mockImplementation(() => Promise.reject(failure()));
    }
    return jest
      .spyOn(ClientSession.prototype, 'commitTransaction')
      .mockImplementation(async function (this: ClientSession) {
        await realCommitTransaction.call(this).catch(() => undefined);
        throw failure();
      });
  }

  it('answers sign-in-required when the unknown commit did land', async () => {
    const email = 'unknown-commit-landed@example.test';
    await seedSignup(email);
    const spy = unknownCommit(true);

    const response = await post(
      '/api/auth/activate',
      activationBody(email, CODE, PASSWORD),
    );
    spy.mockRestore();

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: { requiresTwoFactor: false, mustSignIn: true, user: null },
    });
    expect(response.headers['set-cookie']).toBeUndefined();
    const stored = await users.findOne({ email }).select('+password');
    expect(await bcrypt.compare(PASSWORD, stored?.password ?? '')).toBe(true);
    expect(await pendingRegistrations.countDocuments({ email })).toBe(0);
  });

  it('does not answer sign-in-required when the commit did not land and a foreign account exists', async () => {
    const email = 'unknown-commit-foreign@example.test';
    await seedSignup(email);

    const gate = new RaceGate();
    const spy = jest
      .spyOn(ClientSession.prototype, 'commitTransaction')
      .mockImplementation(async function (this: ClientSession) {
        // Release the transaction's write locks, then let the test insert a
        // foreign account for the same address before this commit reports its
        // unknown result. The transaction never lands.
        await this.abortTransaction().catch(() => undefined);
        await gate.hold();
        throw Object.assign(new Error('unknown commit'), {
          errorLabels: ['UnknownTransactionCommitResult'],
        });
      });

    let response: Response;
    try {
      const activation = Promise.resolve(
        post('/api/auth/activate', activationBody(email, CODE, PASSWORD)),
      );
      await gate.reached(1);
      await users.create({ email, name: 'Foreign', isVerified: true });
      gate.release();
      response = await activation;
    } finally {
      spy.mockRestore();
    }

    expectUnknownOutcome(response);
    expect(response.body).not.toMatchObject({ data: { mustSignIn: true } });
    expect((await users.findOne({ email }))?.name).toBe('Foreign');
  });

  it('answers sign-in-required when an unlabelled network error follows a landed activation', async () => {
    const email = 'network-commit-landed@example.test';
    await seedSignup(email);
    const spy = unknownCommit(true, true);

    const response = await post(
      '/api/auth/activate',
      activationBody(email, CODE, PASSWORD),
    );
    spy.mockRestore();

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: { requiresTwoFactor: false, mustSignIn: true, user: null },
    });
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(await users.countDocuments({ email })).toBe(1);
  });

  it('answers unknown when an unlabelled network error follows an activation that did not land', async () => {
    const email = 'network-commit-lost@example.test';
    await seedSignup(email);
    const read = jest.spyOn(users, 'findById');
    const spy = unknownCommit(false, true);

    const response = await post(
      '/api/auth/activate',
      activationBody(email, CODE, PASSWORD),
    );
    spy.mockRestore();

    expectUnknownOutcome(response);
    expect(response.body).not.toMatchObject({ data: { mustSignIn: true } });
    expect(await users.countDocuments({ email })).toBe(0);
    expect(await pendingRegistrations.countDocuments({ email })).toBe(1);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('leaves the pending record usable when the commit did not land', async () => {
    const email = 'commit-lost@example.test';
    await seedSignup(email);
    const spy = unknownCommit(false);

    const first = await post(
      '/api/auth/activate',
      activationBody(email, CODE, PASSWORD),
    );
    spy.mockRestore();

    expectUnknownOutcome(first);
    expect(await users.countDocuments({ email })).toBe(0);
    expect(await pendingRegistrations.countDocuments({ email })).toBe(1);

    // The code was never consumed, so a normal activation still works.
    const second = await post(
      '/api/auth/activate',
      activationBody(email, CODE, PASSWORD),
    );
    expect(second.status).toBe(200);
  });

  it('answers unknown when the unknown-commit re-read fails', async () => {
    const email = 'commit-read-fail@example.test';
    await seedSignup(email);
    const commitSpy = unknownCommit(false);
    const errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => {});
    const readSpy = jest.spyOn(users, 'findById').mockImplementationOnce(() => {
      throw new TypeError('read failed');
    });

    const response = await post(
      '/api/auth/activate',
      activationBody(email, CODE, PASSWORD),
    );
    readSpy.mockRestore();
    commitSpy.mockRestore();

    expectUnknownOutcome(response);
    const logged = errorSpy.mock.calls
      .map((call: unknown[]) => call.map((v) => String(v)).join(' '))
      .join('\n');
    expect(logged).toContain('cause=name=Error');
    expect(logged).not.toContain('cause=name=TypeError');
    errorSpy.mockRestore();
  });

  it('confirms the change when the unknown email-change commit did land', async () => {
    const email = 'change-commit-landed@example.test';
    const target = await seedEmailChange(email, 4);
    const spy = unknownCommit(true);

    const response = await post('/api/auth/confirm-email-change', {
      email,
      code: CODE,
    });
    spy.mockRestore();

    expect(response.status).toBe(200);
    expect((await users.findById(target._id))?.isVerified).toBe(true);
  });

  it('answers unknown when the email-change commit did not land', async () => {
    const email = 'change-commit-lost@example.test';
    const target = await seedEmailChange(email, 4);
    const spy = unknownCommit(false);

    const response = await post('/api/auth/confirm-email-change', {
      email,
      code: CODE,
    });
    spy.mockRestore();

    expectUnknownOutcome(response);
    expect((await users.findById(target._id))?.isVerified).toBe(false);
  });

  it('confirms the change when an unlabelled network error follows a landed commit', async () => {
    const email = 'network-change-landed@example.test';
    const target = await seedEmailChange(email, 4);
    const spy = unknownCommit(true, true);

    const response = await post('/api/auth/confirm-email-change', {
      email,
      code: CODE,
    });
    spy.mockRestore();

    expect(response.status).toBe(200);
    expect((await users.findById(target._id))?.isVerified).toBe(true);
  });

  it('does not confirm the change when an unlabelled network error follows a commit that did not land', async () => {
    const email = 'network-change-lost@example.test';
    const target = await seedEmailChange(email, 4);
    const read = jest.spyOn(users, 'findById');
    const spy = unknownCommit(false, true);

    const response = await post('/api/auth/confirm-email-change', {
      email,
      code: CODE,
    });
    spy.mockRestore();

    expectUnknownOutcome(response);
    expect(read).toHaveBeenCalledTimes(1);
    expect((await users.findById(target._id))?.isVerified).toBe(false);
  });
});
