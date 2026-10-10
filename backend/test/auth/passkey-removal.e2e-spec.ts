import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Passkey,
  PasskeyDocument,
} from '../../src/auth/passkeys/schemas/passkey.schema';
import { User, UserDocument } from '../../src/user/schemas/user.schema';
import { SEED_USER } from '../constants/seed-users';
import { bootE2eApp, loginAs, type E2eApp } from '../utils/e2e-app';
import { TEST_NOW } from '../utils/frozen-clock';
import {
  SESSION_AUTHORITY_BOOT_TIMEOUT_MS,
  SESSION_AUTHORITY_TEARDOWN_TIMEOUT_MS,
} from '../utils/session-authority-harness';

interface PasskeyList {
  data: { passkeys: { id: string }[]; canRemove?: boolean };
}

describe('removing a passkey (e2e)', () => {
  let e2e: E2eApp;
  let users: Model<UserDocument>;
  let passkeys: Model<PasskeyDocument>;

  beforeAll(async () => {
    e2e = await bootE2eApp();
    users = e2e.app.get<Model<UserDocument>>(getModelToken(User.name));
    passkeys = e2e.app.get<Model<PasskeyDocument>>(getModelToken(Passkey.name));
  }, SESSION_AUTHORITY_BOOT_TIMEOUT_MS);

  afterAll(async () => {
    await e2e?.close();
  }, SESSION_AUTHORITY_TEARDOWN_TIMEOUT_MS);

  beforeEach(async () => {
    e2e.clock.set(TEST_NOW);
    await e2e.reset();
    await passkeys.deleteMany({});
  });

  /** A passkey stored for the seeded user, the way a registration leaves one. */
  async function storePasskey(): Promise<string> {
    const owner = await users
      .findOne({ email: SEED_USER.email })
      .orFail()
      .exec();
    const stored = await passkeys.create({
      user: owner._id,
      credentialId: 'ZTJlLWNyZWRlbnRpYWw',
      publicKey: Buffer.from([1, 2, 3]),
      counter: 0,
      transports: ['internal'],
      deviceType: 'singleDevice',
      backedUp: false,
      name: 'Laptop',
      lastUsedAt: null,
    });
    return stored._id.toString();
  }

  it('removes the passkey of an account that still has its password', async () => {
    const browser = await loginAs(e2e.httpServer, SEED_USER);
    const passkeyId = await storePasskey();

    const offered = await browser.get('/api/auth/passkeys').expect(200);
    expect((offered.body as PasskeyList).data.canRemove).toBe(true);
    await browser.delete(`/api/auth/passkeys/${passkeyId}`).expect(200);

    const listed = await browser.get('/api/auth/passkeys').expect(200);
    expect((listed.body as PasskeyList).data.passkeys).toEqual([]);
    expect(await passkeys.countDocuments({})).toBe(0);
  });

  it('refuses to remove the passkey that is the only way in', async () => {
    const browser = await loginAs(e2e.httpServer, SEED_USER);
    const passkeyId = await storePasskey();
    // Signed in already; from here the account has no password to fall back on.
    await users.updateOne(
      { email: SEED_USER.email },
      { $unset: { password: 1 } },
    );

    // The list says so before the removal is tried.
    const advised = await browser.get('/api/auth/passkeys').expect(200);
    expect((advised.body as PasskeyList).data.canRemove).toBe(false);
    const refused = await browser.delete(`/api/auth/passkeys/${passkeyId}`);

    expect(refused.status).toBe(409);
    expect(refused.body).toMatchObject({
      success: false,
      error: { code: 'PASSKEY_LAST_SIGN_IN_METHOD' },
    });
    const listed = await browser.get('/api/auth/passkeys').expect(200);
    expect((listed.body as PasskeyList).data.passkeys).toEqual([
      expect.objectContaining({ id: passkeyId }),
    ]);
    expect(await passkeys.countDocuments({})).toBe(1);
  });
});
