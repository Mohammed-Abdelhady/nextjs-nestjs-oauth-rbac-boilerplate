import { MalformedIdError } from '../../../../src/common/persistence/persistence-errors';
import { AuthenticatedSessions } from '../../../../src/session/authority/authenticated-session';
import {
  rejectionOf,
  rerunAtOnce,
  SIGN_IN_ADDRESS,
  WEB_CLIENT,
} from '../issuance-contract/issuance-contract-support';
import { AUTHORITY_CONTRACT_CASE_TIMEOUT_MS } from './authority-contract-harness';
import {
  AuthorityHarnessSource,
  sessionIdOf,
} from './authority-contract-support';

const ADA = {
  email: 'ada@example.test',
  name: 'Ada Lovelace',
  role: 'manager',
  permissions: ['posts:read:all', 'users:read:all'],
  verified: false,
};

/** Who a validated session speaks for, and what a request is handed. */
export function authorityIdentityCases(harness: AuthorityHarnessSource): void {
  const budget = AUTHORITY_CONTRACT_CASE_TIMEOUT_MS;

  it(
    'names the account of a committed read by its stored identity',
    async () => {
      const userId = await harness().issuance.seedAccount();
      await harness().setAccountIdentity(userId, ADA);
      const store = harness().authorityStore;
      const account = await store.readCommittedAccount(userId);
      if (!account) throw new Error('the account was not read');

      expect(await store.describeAccount(account)).toEqual({
        id: userId,
        email: 'ada@example.test',
        name: 'Ada Lovelace',
        role: 'manager',
        permissions: ['posts:read:all', 'users:read:all'],
        isVerified: false,
        isDeleted: false,
      });
    },
    budget,
  );

  it(
    'answers from the read it was handed, and reads an account it did not hand out',
    async () => {
      const userId = await harness().issuance.seedAccount();
      await harness().setAccountIdentity(userId, ADA);
      const store = harness().authorityStore;
      const account = await store.readCommittedAccount(userId);
      if (!account) throw new Error('the account was not read');
      await harness().setAccountIdentity(userId, { ...ADA, name: 'Renamed' });

      const held = await store.describeAccount(account);
      const fresh = await store.describeAccount({
        id: userId,
        isDeleted: false,
        sessionVersion: 0,
      });

      expect({ held: held?.name, fresh: fresh?.name }).toEqual({
        held: 'Ada Lovelace',
        fresh: 'Renamed',
      });
    },
    budget,
  );

  it(
    'names a deactivated account as deactivated and no account as nobody',
    async () => {
      const userId = await harness().issuance.seedAccount();
      await harness().markAccountDeleted(userId);
      const store = harness().authorityStore;
      const account = await store.readCommittedAccount(userId);
      if (!account) throw new Error('the account was not read');
      const stranger = { isDeleted: false, sessionVersion: 0 };

      expect({
        deleted: (await store.describeAccount(account))?.isDeleted,
        absent: await store.describeAccount({
          ...stranger,
          id: harness().issuance.absentAccountId(),
        }),
        foreign:
          (await rejectionOf(
            store.describeAccount({
              ...stranger,
              id: harness().issuance.foreignAccountId(),
            }),
          )) instanceof MalformedIdError,
      }).toEqual({ deleted: true, absent: null, foreign: true });
    },
    budget,
  );

  it(
    'hands a request the session with its browser secret and its account',
    async () => {
      const userId = await harness().issuance.seedAccount();
      await harness().setAccountIdentity(userId, ADA);
      const issued = await harness()
        .issuance.service(rerunAtOnce)
        .createBrowserSession(
          userId,
          'Contract/1',
          SIGN_IN_ADDRESS,
          WEB_CLIENT,
        );
      const sessionId = await sessionIdOf(
        harness(),
        userId,
        issued.sessionToken,
      );
      const sessions = new AuthenticatedSessions(harness().authorityStore);

      const authenticated = await sessions.of(
        await harness().validator().validateByToken(issued.sessionToken, false),
      );

      expect({
        id: authenticated?.id,
        userId: authenticated?.userId,
        clientId: authenticated?.clientId,
        csrfToken: authenticated?.csrfToken,
        authenticationMethods: authenticated?.authenticationMethods,
        credentialPurpose: authenticated?.credentialPurpose,
        userAgent: authenticated?.userAgent,
        storedSince: authenticated?.createdAt instanceof Date,
        user: authenticated?.user,
        nobody: await sessions.of(null),
      }).toEqual({
        id: sessionId,
        userId,
        clientId: WEB_CLIENT,
        csrfToken: issued.csrfToken,
        authenticationMethods: [],
        credentialPurpose: 'browser_session',
        userAgent: 'Contract/1',
        storedSince: true,
        user: {
          id: userId,
          email: 'ada@example.test',
          name: 'Ada Lovelace',
          role: 'manager',
          permissions: ['posts:read:all', 'users:read:all'],
          isVerified: false,
          isDeleted: false,
        },
        nobody: null,
      });
    },
    budget,
  );
}
