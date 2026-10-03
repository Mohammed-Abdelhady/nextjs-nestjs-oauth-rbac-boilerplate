import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import type { Response } from 'supertest';
import { User, UserDocument } from '../../src/user/schemas/user.schema';
import { PendingRegistration } from '../../src/auth/schemas/pending-registration.schema';
import { PENDING_PURPOSE } from '../../src/auth/constants/registration';
import {
  bootE2eApp,
  browserAgent,
  loginAs,
  E2E_CLIENT_URL,
  type E2eApp,
  type TestAgent,
} from '../utils/e2e-app';
import {
  EMAIL_CHANGE_CONFIRM_PATH,
  EMAIL_CHANGE_EMAIL_SUBJECT,
} from '../../src/mail/constants/mail.constants';
import { SEED_ADMIN } from '../constants/seed-users';
import { TEST_NOW } from '../utils/frozen-clock';
import {
  SESSION_AUTHORITY_BOOT_TIMEOUT_MS,
  SESSION_AUTHORITY_TEARDOWN_TIMEOUT_MS,
} from '../utils/session-authority-harness';

const MAX_ATTEMPTS = 5;

describe('Admin email change confirmation (e2e)', () => {
  let e2e: E2eApp;
  let users: Model<UserDocument>;
  let pendingRegistrations: Model<PendingRegistration>;
  let adminAgent: TestAgent;

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
    // reset clears sessions, so the admin signs in again for each case.
    adminAgent = await loginAs(e2e.httpServer, SEED_ADMIN);
  });

  afterAll(async () => {
    await e2e?.close();
  }, SESSION_AUTHORITY_TEARDOWN_TIMEOUT_MS);

  async function createTarget(email = 'orig@example.test') {
    return users.create({
      email,
      name: 'Target User',
      role: 'user',
      isVerified: true,
      addressGeneration: 0,
    });
  }

  function move(id: string, email: string): Promise<Response> {
    return adminAgent.patch(`/api/admin/users/${id}`).send({ email });
  }

  function confirm(email: string, code: string): Promise<Response> {
    return browserAgent(e2e.httpServer).then((agent) =>
      agent.post('/api/auth/confirm-email-change').send({ email, code }),
    );
  }

  async function latestCode(): Promise<string> {
    await e2e.captureMail();
    return await e2e.mailedCode();
  }

  it('confirms after a move away and back inside the code lifetime', async () => {
    const target = await createTarget();
    const id = target._id.toString();

    await move(id, 'x@example.test');
    await move(id, 'y@example.test');
    await move(id, 'x@example.test');

    const stored = await users.findById(target._id);
    expect(stored?.email).toBe('x@example.test');
    expect(stored?.addressGeneration).toBe(3);
    expect(stored?.isVerified).toBe(false);

    const record = await pendingRegistrations.findOne({
      email: 'x@example.test',
    });
    expect(record?.addressGeneration).toBe(3);
    expect(record?.purpose).toBe(PENDING_PURPOSE.EMAIL_CHANGE);

    const code = await latestCode();
    const response = await confirm('x@example.test', code);
    expect(response.status).toBe(200);

    const confirmed = await users.findById(target._id);
    expect(confirmed?.isVerified).toBe(true);
  });

  it('re-sends a confirmation after the attempts are exhausted, resetting them', async () => {
    const target = await createTarget();
    const id = target._id.toString();
    await move(id, 'moved@example.test');

    const code = await latestCode();
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      await confirm('moved@example.test', '000000');
    }
    const locked = await pendingRegistrations.findOne({
      email: 'moved@example.test',
    });
    expect(locked?.attempts).toBe(MAX_ATTEMPTS);

    const before = (await e2e.captureMail()).length;
    const resent = await adminAgent
      .post(`/api/admin/users/${id}/resend-email-change`)
      .send({});
    expect(resent.status).toBe(200);
    await e2e.captureMail();
    expect((await e2e.captureMail()).length - before).toBe(1);

    const refreshed = await pendingRegistrations.findOne({
      email: 'moved@example.test',
    });
    expect(refreshed?.attempts).toBe(0);

    const freshCode = await latestCode();
    expect(freshCode).not.toBe(code);
    const response = await confirm('moved@example.test', freshCode);
    expect(response.status).toBe(200);
    expect((await users.findById(target._id))?.isVerified).toBe(true);
  });

  it('names the change and links to the confirmation page in the mail', async () => {
    const target = await createTarget();
    await move(target._id.toString(), 'moved@example.test');
    await e2e.captureMail();

    const confirmUrl = `${E2E_CLIENT_URL}${EMAIL_CHANGE_CONFIRM_PATH}`;
    const mail = (await e2e.captureMail()).at(-1);
    expect(mail?.subject).toBe(EMAIL_CHANGE_EMAIL_SUBJECT);
    expect(mail?.text).toContain(confirmUrl);
    expect(mail?.html).toContain(`href="${confirmUrl}"`);
    expect(mail?.text).not.toContain('registering');
  });

  it('refuses to re-send for a verified address', async () => {
    const target = await createTarget();

    const response = await adminAgent
      .post(`/api/admin/users/${target._id.toString()}/resend-email-change`)
      .send({});

    expect(response.status).toBe(400);
  });
});
