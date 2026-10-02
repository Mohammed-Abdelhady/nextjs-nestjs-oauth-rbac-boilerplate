import { Logger } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import type { Response } from 'supertest';
import {
  GENERIC_CODE_SENT_MESSAGE,
  PASSWORD_RESET_EMAIL_FAILED_MESSAGE,
} from '../../src/auth/constants/auth-messages';
// feature:magic-link:start
import { randomUUID } from 'node:crypto';
import { MAGIC_LINK_MAX_PER_HOUR } from '../../src/auth/magic-link/magic-link.harness-spec';
import { MAGIC_LINK_SENT_MESSAGE } from '../../src/auth/magic-link/constants/magic-link.constants';
import type { PendingMagicLinkDocument } from '../../src/auth/magic-link/schemas/pending-magic-link.schema';
// feature:magic-link:end
import type { PendingRegistrationDocument } from '../../src/auth/schemas/pending-registration.schema';
import { REQUEST_ID_HEADER } from '../../src/common/constants/request-id';
import type { UserDocument } from '../../src/user/schemas/user.schema';
import { bootE2eApp, browserAgent, type E2eApp } from '../utils/e2e-app';
import { TEST_NOW } from '../utils/frozen-clock';
import {
  SESSION_AUTHORITY_BOOT_TIMEOUT_MS,
  SESSION_AUTHORITY_TEARDOWN_TIMEOUT_MS,
} from '../utils/session-authority-harness';

const PASSWORD = 'Password123!';

/** Success body every address-request route returns. */
interface AddressRequestResponse {
  success: true;
  data: { email: string };
  message: string;
}

/** Per-request headers two answers are not expected to share. */
const VOLATILE_HEADERS = new Set([
  'date',
  'x-request-id',
  'x-ratelimit-limit',
  'x-ratelimit-remaining',
  'x-ratelimit-reset',
  'retry-after',
]);

function expectSameAnswer(actual: Response, expected: Response): void {
  expect(actual.status).toBe(expected.status);
  expect(actual.text).toBe(expected.text);
  expect(actual.headers['set-cookie']).toBeUndefined();
  expect(expected.headers['set-cookie']).toBeUndefined();

  const stable = (response: Response): Record<string, string> => {
    const headers: Record<string, string> = {};
    for (const [name, value] of Object.entries(response.headers)) {
      if (!VOLATILE_HEADERS.has(name.toLowerCase())) headers[name] = value;
    }
    return headers;
  };
  expect(stable(actual)).toEqual(stable(expected));
}

/**
 * The routes that take an address from a signed-out caller and mail it.
 * The mail boundary is made to fail, which is the condition that used to turn
 * an existing account into a different answer from an unknown address.
 */
describe('Address-request routes with a failing mail boundary (e2e)', () => {
  let e2e: E2eApp;
  let users: Model<UserDocument>;
  let pendingRegistrations: Model<PendingRegistrationDocument>;
  // feature:magic-link:start
  let pendingMagicLinks: Model<PendingMagicLinkDocument>;
  // feature:magic-link:end

  beforeAll(async () => {
    e2e = await bootE2eApp(0, {
      failMail: true,
      magicLinkEnabled: true, // feature:magic-link
    });
    users = e2e.app.get<Model<UserDocument>>(getModelToken('User'));
    pendingRegistrations = e2e.app.get<Model<PendingRegistrationDocument>>(
      getModelToken('PendingRegistration'),
    );
    // feature:magic-link:start
    pendingMagicLinks = e2e.app.get<Model<PendingMagicLinkDocument>>(
      getModelToken('PendingMagicLink'),
    );
    // feature:magic-link:end
  }, SESSION_AUTHORITY_BOOT_TIMEOUT_MS);

  beforeEach(async () => {
    e2e.clock.set(TEST_NOW);
    await e2e.reset();
  });

  afterAll(async () => {
    await e2e?.close();
  }, SESSION_AUTHORITY_TEARDOWN_TIMEOUT_MS);

  afterEach(() => {
    jest.restoreAllMocks();
  });

  async function post(
    path: string,
    body: Record<string, string>,
  ): Promise<Response> {
    const agent = await browserAgent(e2e.httpServer);
    return agent.post(path).send(body);
  }

  function createVerifiedAccount(email: string): Promise<unknown> {
    return users.create({ email, name: 'Existing Account', isVerified: true });
  }

  // feature:magic-link:start
  async function seedCappedMagicLinks(email: string): Promise<void> {
    await pendingMagicLinks.create(
      Array.from({ length: MAGIC_LINK_MAX_PER_HOUR }, () => ({
        email,
        tokenHash: randomUUID(),
        expiresAt: new Date(TEST_NOW.getTime() + 15 * 60 * 1000),
        consumedAt: null,
        createdAt: TEST_NOW,
        updatedAt: TEST_NOW,
      })),
      { timestamps: false },
    );
  }
  // feature:magic-link:end

  it('answers forgot-password the same for a real address and an unknown one', async () => {
    const email = 'forgot-enum@example.test';

    const unknownBefore = e2e.mail.length;
    const unknown = await post('/api/auth/forgot-password', { email });
    expect(e2e.mail.length - unknownBefore).toBe(0);

    await createVerifiedAccount(email);

    const knownBefore = e2e.mail.length;
    const known = await post('/api/auth/forgot-password', { email });
    expect(e2e.mail.length - knownBefore).toBe(1);

    expectSameAnswer(known, unknown);
    expect(unknown.body as AddressRequestResponse).toEqual({
      success: true,
      data: { email },
      message: GENERIC_CODE_SENT_MESSAGE,
    });
  });

  it('answers resend-activation the same with and without a pending registration', async () => {
    const email = 'resend-enum@example.test';

    const unknownBefore = e2e.mail.length;
    const unknown = await post('/api/auth/resend-activation', { email });
    expect(e2e.mail.length - unknownBefore).toBe(0);

    await pendingRegistrations.create({
      email,
      name: 'Pending Account',
      hashedCode: 'a-hashed-code',
      attempts: 0,
      expiresAt: new Date(TEST_NOW.getTime() + 15 * 60 * 1000),
    });

    const pendingBefore = e2e.mail.length;
    const pending = await post('/api/auth/resend-activation', { email });
    expect(e2e.mail.length - pendingBefore).toBe(1);

    expectSameAnswer(pending, unknown);
    expect(unknown.body as AddressRequestResponse).toEqual({
      success: true,
      data: { email },
      message: GENERIC_CODE_SENT_MESSAGE,
    });
  });

  it('answers register the same for a taken address and a free one', async () => {
    const email = 'register-enum@example.test';

    const freeBefore = e2e.mail.length;
    const free = await post('/api/auth/register', {
      email,
      password: PASSWORD,
      name: 'New Account',
    });
    expect(e2e.mail.length - freeBefore).toBe(1);

    await createVerifiedAccount(email);

    const takenBefore = e2e.mail.length;
    const taken = await post('/api/auth/register', {
      email,
      password: PASSWORD,
      name: 'New Account',
    });
    expect(e2e.mail.length - takenBefore).toBe(1);

    expectSameAnswer(taken, free);
    expect(free.body as AddressRequestResponse).toEqual({
      success: true,
      data: { email },
      message: GENERIC_CODE_SENT_MESSAGE,
    });
  });

  // feature:magic-link:start
  it('answers a magic-link request the same for a real address and an unknown one', async () => {
    const email = 'magic-enum@example.test';

    const unknownBefore = e2e.mail.length;
    const unknown = await post('/api/auth/magic-link/request', { email });
    expect(e2e.mail.length - unknownBefore).toBe(1);

    await createVerifiedAccount(email);

    const knownBefore = e2e.mail.length;
    const known = await post('/api/auth/magic-link/request', { email });
    expect(e2e.mail.length - knownBefore).toBe(1);

    expectSameAnswer(known, unknown);
    expect(unknown.body as AddressRequestResponse).toEqual({
      success: true,
      data: { email },
      message: MAGIC_LINK_SENT_MESSAGE,
    });
  });

  it('answers a soft-deleted magic-link request the same as a mailed one', async () => {
    const email = 'magic-deleted-enum@example.test';

    const mailedBefore = e2e.mail.length;
    const mailed = await post('/api/auth/magic-link/request', { email });
    expect(e2e.mail.length - mailedBefore).toBe(1);

    await users.create({ email, name: 'Deleted Account', isDeleted: true });

    const deletedBefore = e2e.mail.length;
    const deleted = await post('/api/auth/magic-link/request', { email });
    expect(e2e.mail.length - deletedBefore).toBe(0);

    expectSameAnswer(deleted, mailed);
    expect(deleted.body as AddressRequestResponse).toEqual({
      success: true,
      data: { email },
      message: MAGIC_LINK_SENT_MESSAGE,
    });
  });

  it('answers a magic-link request over the hourly cap the same as a mailed one', async () => {
    const email = 'magic-cap-enum@example.test';

    const mailedBefore = e2e.mail.length;
    const mailed = await post('/api/auth/magic-link/request', { email });
    expect(e2e.mail.length - mailedBefore).toBe(1);

    await seedCappedMagicLinks(email);

    const cappedBefore = e2e.mail.length;
    const capped = await post('/api/auth/magic-link/request', { email });
    expect(e2e.mail.length - cappedBefore).toBe(0);

    expectSameAnswer(capped, mailed);
    expect(capped.body as AddressRequestResponse).toEqual({
      success: true,
      data: { email },
      message: MAGIC_LINK_SENT_MESSAGE,
    });
  });

  it('does not log a sent line when the link could not be mailed', async () => {
    const logSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => {});
    const email = 'magic-log-enum@example.test';

    const before = e2e.mail.length;
    await post('/api/auth/magic-link/request', { email });
    expect(e2e.mail.length - before).toBe(1);

    const logged = logSpy.mock.calls.map((call) =>
      call.map((argument) => String(argument)).join(' '),
    );
    expect(
      logged.filter((line) => line.includes('Magic link sent to')),
    ).toEqual([]);
  });
  // feature:magic-link:end

  it('logs the delivery failure with the request id, and this service logs no address', async () => {
    const errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => {});
    const email = 'log-enum@example.test';
    await createVerifiedAccount(email);

    const before = e2e.mail.length;
    const response = await (
      await browserAgent(e2e.httpServer)
    )
      .post('/api/auth/forgot-password')
      .set(REQUEST_ID_HEADER, 'enum-log-request-id')
      .send({ email });
    expect(e2e.mail.length - before).toBe(1);

    expect(response.status).toBe(200);
    const logged = errorSpy.mock.calls.map((call) =>
      call.map((argument) => String(argument)).join(' '),
    );
    expect(logged).toContain(
      `${PASSWORD_RESET_EMAIL_FAILED_MESSAGE} requestId=enum-log-request-id cause=Error`,
    );
    expect(logged.filter((line) => line.includes(email))).toEqual([]);
  });
});
