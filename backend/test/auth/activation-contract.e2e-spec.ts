import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import type { Response } from 'supertest';
import * as bcrypt from 'bcrypt';
import { ErrorCode } from '../../src/common/enums/error-code.enum';
import { partialMock } from '../../src/common/testing/test-doubles.harness-spec';
import {
  Role,
  RoleDocument,
} from '../../src/role/persistence/mongo/schemas/role.schema';
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
const PASSWORD = 'Password123!';
const NAME = 'Test User';
const LIVE_EXPIRY = new Date(TEST_NOW.getTime() + 15 * 60 * 1000);
const TOO_LONG_PASSWORD = `A1${'a'.repeat(71)}`;

describe('Activation contract (e2e)', () => {
  let e2e: E2eApp;
  let pendingRegistrations: Model<PendingRegistration>;
  let users: Model<UserDocument>;

  beforeAll(async () => {
    e2e = await bootE2eApp();
    pendingRegistrations = e2e.app.get<Model<PendingRegistration>>(
      getModelToken('PendingRegistration'),
    );
    users = e2e.app.get<Model<UserDocument>>(getModelToken(User.name));
  }, SESSION_AUTHORITY_BOOT_TIMEOUT_MS);

  beforeEach(async () => {
    e2e.clock.set(TEST_NOW);
    e2e.app.get(ConfigService).set('auth.passwordEnabled', true);
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
    body: Record<string, unknown>,
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

  async function seedSignup(
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

  async function seedEmailChange(
    email: string,
    userId: Types.ObjectId,
    addressGeneration: number,
  ): Promise<void> {
    await pendingRegistrations.create({
      email,
      ...pendingFields({
        purpose: PENDING_PURPOSE.EMAIL_CHANGE,
        hashedCode: await bcrypt.hash(CODE, 4),
        userId,
        addressGeneration,
      }),
    });
  }

  it('refuses an old-shape registration the same way for a free and a taken address', async () => {
    const takenEmail = 'old-taken@example.test';
    await users.create({ email: takenEmail, name: 'Taken', isVerified: true });

    const free = await post('/api/auth/register', {
      email: 'old-free@example.test',
      password: PASSWORD,
      name: NAME,
    });
    const taken = await post('/api/auth/register', {
      email: takenEmail,
      password: PASSWORD,
      name: NAME,
    });

    expect(taken.status).toBe(free.status);
    expect(taken.body.error).toEqual(free.body.error);
    expect(free.status).toBe(400);
    expect(free.body).toMatchObject({
      success: false,
      error: { code: ErrorCode.REGISTRATION_CONTRACT_OUTDATED },
    });
  });

  it.each([
    {
      label: 'over-long password',
      body: { code: CODE, password: TOO_LONG_PASSWORD, name: NAME },
    },
    {
      label: 'weak password',
      body: { code: CODE, password: 'short', name: NAME },
    },
    {
      label: 'empty name',
      body: { code: CODE, password: PASSWORD, name: '' },
    },
    {
      label: 'malformed code',
      body: { code: 'abc', password: PASSWORD, name: NAME },
    },
    {
      label: 'missing password',
      body: { code: CODE, name: NAME },
    },
    {
      label: 'null password',
      body: { code: CODE, password: null, name: NAME },
    },
    {
      label: 'null code',
      body: { code: null, password: PASSWORD, name: NAME },
    },
  ])(
    'answers invalid activation fields the same for every address state: $label',
    async ({ body }) => {
      const email = 'validate@example.test';
      await seedSignup(email);
      const seeded = await post('/api/auth/activate', { email, ...body });
      const unknown = await post('/api/auth/activate', {
        email: 'none@example.test',
        ...body,
      });

      expect(unknown.status).toBe(seeded.status);
      expect(unknown.body.error).toEqual(seeded.body.error);
      expect(seeded.status).toBe(400);
      expect(seeded.body).toMatchObject({
        success: false,
        error: { code: ErrorCode.VALIDATION_ERROR },
      });

      const record = await pendingRegistrations.findOne({ email });
      expect(record?.attempts).toBe(0);
    },
  );

  it('never honours an old-shape pending record', async () => {
    const email = 'legacy@example.test';
    await pendingRegistrations.collection.insertOne({
      email,
      name: 'Legacy',
      hashedCode: await bcrypt.hash(CODE, 4),
      attempts: 0,
      expiresAt: LIVE_EXPIRY,
    });

    const activated = await post('/api/auth/activate', {
      email,
      code: CODE,
      password: PASSWORD,
      name: NAME,
    });
    const confirmed = await post('/api/auth/confirm-email-change', {
      email,
      code: CODE,
    });

    expect(activated.status).toBe(400);
    expect(activated.body).toMatchObject({
      success: false,
      error: { code: ErrorCode.ACTIVATION_CODE_INVALID },
    });
    expect(confirmed.status).toBe(400);
    expect(confirmed.body).toMatchObject({
      success: false,
      error: { code: ErrorCode.ACTIVATION_CODE_INVALID },
    });
  });

  it('does not let a sign-up code confirm an address change or the reverse', async () => {
    const signupEmail = 'cross-signup@example.test';
    await seedSignup(signupEmail);
    const asConfirm = await post('/api/auth/confirm-email-change', {
      email: signupEmail,
      code: CODE,
    });
    expect(asConfirm.status).toBe(400);
    expect(asConfirm.body).toMatchObject({
      success: false,
      error: { code: ErrorCode.ACTIVATION_CODE_INVALID },
    });

    const changeEmail = 'cross-change@example.test';
    const target = await users.create({
      email: changeEmail,
      name: 'Target',
      isVerified: false,
      addressGeneration: 1,
    });
    await seedEmailChange(changeEmail, target._id, 1);
    const asActivate = await post('/api/auth/activate', {
      email: changeEmail,
      code: CODE,
      password: PASSWORD,
      name: NAME,
    });
    expect(asActivate.status).toBe(400);
    expect(asActivate.body).toMatchObject({
      success: false,
      error: { code: ErrorCode.ACTIVATION_CODE_INVALID },
    });
  });

  it('confirms an address change without a session, with password sign-in disabled', async () => {
    const email = 'moved@example.test';
    const target = await users.create({
      email,
      name: 'Target',
      isVerified: false,
      addressGeneration: 3,
    });
    await seedEmailChange(email, target._id, 3);
    e2e.app.get(ConfigService).set('auth.passwordEnabled', false);

    const response = await post('/api/auth/confirm-email-change', {
      email,
      code: CODE,
    });

    expect(response.status).toBe(200);
    expect(response.headers['set-cookie']).toBeUndefined();
    const stored = await users.findById(target._id);
    expect(stored?.isVerified).toBe(true);
  });

  it('leaves the code usable when the account write fails before the commit', async () => {
    const email = 'write-fails@example.test';
    await post('/api/auth/register', { email });
    const code = await e2e.mailedCode();
    const saveSpy = jest
      .spyOn(users.prototype, 'save')
      .mockRejectedValueOnce(new Error('account write failed'));

    const failed = await post('/api/auth/activate', {
      email,
      code,
      password: PASSWORD,
      name: NAME,
    });
    expect(failed.status).toBe(500);
    saveSpy.mockRestore();

    const retried = await post('/api/auth/activate', {
      email,
      code,
      password: PASSWORD,
      name: NAME,
    });
    expect(retried.status).toBe(200);
    expect(await users.countDocuments({ email })).toBe(1);
  });

  it('issues no session cookie when the role read fails after the commit', async () => {
    const email = 'role-read-fails@example.test';
    await post('/api/auth/register', { email });
    const code = await e2e.mailedCode();
    const roles = e2e.app.get<Model<RoleDocument>>(getModelToken(Role.name));
    const roleSpy = jest.spyOn(roles, 'findOne').mockReturnValueOnce(
      partialMock<ReturnType<typeof roles.findOne>>({
        exec: jest.fn().mockRejectedValue(new Error('role read failed')),
      }),
    );

    const response = await post('/api/auth/activate', {
      email,
      code,
      password: PASSWORD,
      name: NAME,
    });
    roleSpy.mockRestore();

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: { requiresTwoFactor: false, mustSignIn: true, user: null },
    });
    expect(response.headers['set-cookie']).toBeUndefined();

    const stored = await users.findOne({ email }).select('+password');
    expect(stored?.isVerified).toBe(true);
    expect(await bcrypt.compare(PASSWORD, stored?.password ?? '')).toBe(true);
  });
});
