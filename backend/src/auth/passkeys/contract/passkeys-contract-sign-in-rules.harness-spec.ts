import { holdBefore, RaceGate } from '../../../../test/utils/race-gate';
import {
  browser,
  credential,
  CREDENTIAL_ID,
  NOW,
  outcomeOf,
  passkeyCase,
  PasskeysFixture,
  PasskeysHarnessSource,
  passkeyServices,
  refusalOf,
  sha256,
  signInBrowser,
} from './passkeys-contract.harness-spec';

const CHALLENGE_INVALID = { code: 'PASSKEY_CHALLENGE_INVALID', status: 401 };
const VERIFICATION_FAILED = {
  code: 'PASSKEY_VERIFICATION_FAILED',
  status: 401,
};
const FEATURE_DISABLED = { code: 'FEATURE_DISABLED', status: 404 };

function at(offsetMs: number): Date {
  return new Date(NOW.getTime() + offsetMs);
}

/** A sign-in challenge works once and lapses, and a second step takes only its own account. */
export function signInRuleCases(
  harness: PasskeysHarnessSource,
  fixture: () => PasskeysFixture,
): void {
  passkeyCase(
    'issues one session when two requests answer one sign-in challenge at once',
    async () => {
      const { ownerId } = fixture();
      const services = passkeyServices(harness());
      await harness().seedPasskey({
        userId: ownerId,
        credentialId: CREDENTIAL_ID,
        counter: 4,
        createdAt: NOW,
      });
      const holder = await signInBrowser(services);
      const copy = browser(holder.cookies);
      services.authenticator.assertion = { newCounter: 5, userVerified: true };
      const gate = new RaceGate();
      const restore = holdBefore(harness().challenges, 'consume', () => gate);

      const attempts = [holder, copy].map((from) =>
        outcomeOf(
          services.login.verify(
            { response: credential() },
            from.request,
            from.response,
          ),
        ),
      );
      await gate.reached(2);
      gate.release();
      const outcomes = await Promise.all(attempts);
      restore();

      expect(outcomes.sort()).toEqual([
        'PASSKEY_CHALLENGE_INVALID',
        'accepted',
      ]);
      expect(services.signIn.issued).toEqual([ownerId]);
      expect(services.authenticator.checkedAgainst).toHaveLength(1);
    },
  );

  passkeyCase(
    'refuses a sign-in challenge at its expiry though its row is stored, a registration challenge, and no cookie',
    async () => {
      const { ownerId } = fixture();
      const services = passkeyServices(harness());
      const { clock } = harness();
      await harness().seedPasskey({
        userId: ownerId,
        credentialId: CREDENTIAL_ID,
        counter: 4,
        createdAt: NOW,
      });
      services.authenticator.assertion = { newCounter: 5, userVerified: true };
      const verify = (from: ReturnType<typeof browser>): Promise<unknown> =>
        services.login.verify(
          { response: credential() },
          from.request,
          from.response,
        );

      const forRegistration = browser();
      await services.registration.createOptions(
        ownerId,
        forRegistration.response,
      );
      expect(await refusalOf(verify(forRegistration))).toEqual(
        CHALLENGE_INVALID,
      );
      expect(await refusalOf(verify(browser()))).toEqual(CHALLENGE_INVALID);

      const holder = await signInBrowser(services);
      const hash = sha256('contract-challenge-2');
      await harness().setChallengeExpiry(hash, at(1000));
      const copy = browser(holder.cookies);
      clock.set(at(1000));
      expect(await refusalOf(verify(holder))).toEqual(CHALLENGE_INVALID);
      expect(
        (await harness().storedChallenges()).map(
          (challenge) => challenge.challengeHash,
        ),
      ).toContain(hash);
      expect(services.signIn.issued).toEqual([]);
      expect(await harness().storedPasskeys()).toMatchObject([
        { counter: 4, lastUsedAt: null },
      ]);

      clock.set(at(999));
      await verify(copy);
      expect(services.signIn.issued).toEqual([ownerId]);
    },
  );

  passkeyCase(
    'answers a second step only with a passkey of the challenged account, and not at all when switched off',
    async () => {
      const { ownerId, otherId } = fixture();
      const services = passkeyServices(harness());
      await harness().seedPasskey({
        userId: ownerId,
        credentialId: CREDENTIAL_ID,
        counter: 4,
        createdAt: NOW,
      });
      const answer = { passkeyResponse: credential() };
      expect(services.verifier.supports(answer)).toBe(true);
      expect(services.verifier.supports({})).toBe(false);

      services.authenticator.assertion = { newCounter: 5, userVerified: false };
      const own = await signInBrowser(services);
      await services.verifier.verify(
        answer,
        { id: ownerId },
        own.request,
        own.response,
      );

      services.authenticator.assertion = { newCounter: 6, userVerified: false };
      const foreign = await signInBrowser(services);
      expect(
        await refusalOf(
          services.verifier.verify(
            answer,
            { id: otherId },
            foreign.request,
            foreign.response,
          ),
        ),
      ).toEqual(VERIFICATION_FAILED);

      const off = passkeyServices(harness(), { passkeys: false });
      const closed = await signInBrowser(off);
      off.storeCalls.length = 0;
      expect(
        await refusalOf(
          off.verifier.verify(
            answer,
            { id: ownerId },
            closed.request,
            closed.response,
          ),
        ),
      ).toEqual(FEATURE_DISABLED);
      expect(off.storeCalls).toEqual([]);
      // The verifier issues no session of its own.
      expect(services.signIn).toMatchObject({ issued: [], completed: [] });
    },
  );
}
