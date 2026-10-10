import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ErrorCode } from '../../src/common/enums/error-code.enum';
import { MailService } from '../../src/mail/mail.service';
import { UserRole } from '../../src/user/enums/user-role.enum';
import {
  User,
  UserDocument,
} from '../../src/user/persistence/mongo/schemas/user.schema';
import { SEED_ADMIN } from '../constants/seed-users';
import { bootE2eApp, loginAs, E2eApp, TestAgent } from '../utils/e2e-app';
import { inWindow } from '../utils/pending-race';
import {
  SESSION_AUTHORITY_BOOT_TIMEOUT_MS,
  SESSION_AUTHORITY_TEARDOWN_TIMEOUT_MS,
} from '../utils/session-authority-harness';

const ORIGINAL_EMAIL = 'fresh-original@example.test';
const NEW_EMAIL = 'fresh-next@example.test';
const NEW_NAME = 'Updated Name';

interface ErrorBody {
  error: { code: string };
}

describe('admin email writes authorize fresh state after mail preparation', () => {
  let e2e: E2eApp;
  let users: Model<UserDocument>;
  let admin: TestAgent;
  let actor: UserDocument;
  let target: UserDocument;

  beforeAll(async () => {
    e2e = await bootE2eApp();
    users = e2e.app.get<Model<UserDocument>>(getModelToken(User.name));
  }, SESSION_AUTHORITY_BOOT_TIMEOUT_MS);
  beforeEach(async () => {
    await e2e.reset();
    admin = await loginAs(e2e.httpServer, SEED_ADMIN);
    const found = await users.findOne({ email: SEED_ADMIN.email });
    if (!found) throw new Error('Missing admin fixture');
    actor = found;
    target = await users.create({
      email: ORIGINAL_EMAIL,
      name: 'Target',
      role: UserRole.USER,
      addressGeneration: 0,
      isVerified: true,
    });
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    await e2e?.close();
  }, SESSION_AUTHORITY_TEARDOWN_TIMEOUT_MS);

  function move() {
    return admin.patch(`/api/admin/users/${target._id.toString()}`).send({
      email: NEW_EMAIL,
      name: NEW_NAME,
    });
  }

  async function stored() {
    const user = await users.findById(target._id);
    return {
      email: user?.email,
      name: user?.name,
      generation: user?.addressGeneration,
      verified: user?.isVerified,
    };
  }

  function duringMail(interfere: () => Promise<unknown>) {
    return inWindow(
      (gate) => {
        const mail = e2e.app.get(MailService);
        const send = mail.sendMail.bind(mail);
        const spy = jest
          .spyOn(mail, 'sendMail')
          .mockImplementation(async (options) => {
            await send(options);
            await gate.hold();
          });
        return () => spy.mockRestore();
      },
      () => Promise.resolve(move()),
      interfere,
    );
  }

  it('stores the name and address with the new verification generation', async () => {
    await move().expect(200);
    expect(await stored()).toEqual({
      email: NEW_EMAIL,
      name: NEW_NAME,
      generation: 1,
      verified: false,
    });
  });

  it.each([
    {
      change: { role: UserRole.MANAGER },
      code: ErrorCode.EMAIL_CHANGE_NOT_ALLOWED,
    },
    { change: { isDeleted: true }, code: ErrorCode.SESSION_INVALID },
  ])('refuses a stale actor after $code', async ({ change, code }) => {
    const response = await duringMail(() =>
      users.updateOne({ _id: actor._id }, { $set: change }),
    );
    expect(response.status).toBe(
      code === ErrorCode.SESSION_INVALID ? 401 : 403,
    );
    expect((response.body as ErrorBody).error.code).toBe(code);
    expect(await stored()).toEqual({
      email: ORIGINAL_EMAIL,
      name: 'Target',
      generation: 0,
      verified: true,
    });
  });

  it('refuses an email edit after the target becomes a peer', async () => {
    const response = await duringMail(() =>
      users.updateOne({ _id: target._id }, { $set: { role: UserRole.ADMIN } }),
    );
    expect(response.status).toBe(403);
    expect((response.body as ErrorBody).error.code).toBe(
      ErrorCode.CANNOT_MODIFY_HIGHER_ROLE,
    );
    expect(await stored()).toEqual({
      email: ORIGINAL_EMAIL,
      name: 'Target',
      generation: 0,
      verified: true,
    });
  });

  it('does not overwrite an email generation committed during preparation', async () => {
    const response = await duringMail(() =>
      users.updateOne(
        { _id: target._id },
        { $set: { addressGeneration: 2, isVerified: false } },
      ),
    );
    expect(response.status).toBe(409);
    expect((response.body as ErrorBody).error.code).toBe(ErrorCode.CONFLICT);
    expect(await stored()).toEqual({
      email: ORIGINAL_EMAIL,
      name: 'Target',
      generation: 2,
      verified: false,
    });
  });
});
