import { ErrorCode } from '../../../common/enums/error-code.enum';
import { PASSKEY_CHALLENGE_COOKIE } from '../constants/passkeys.constants';
import { PasskeyAssertionService } from './passkey-assertion.service';
import { WebAuthnAdapter } from './webauthn.adapter';
import {
  CREDENTIAL_BODY,
  CREDENTIAL_ID,
  createChallengeService,
  createMockPasskey,
  createMockRequest,
  createMockResponse,
  createPasskeyConfig,
  MockPasskey,
  RP_ID,
} from '../passkeys.harness-spec';

/** The signature check itself is the library's; everything around it is here. */

interface Harness {
  service: PasskeyAssertionService;
  adapter: {
    createAuthenticationOptions: jest.Mock;
    verifyAssertion: jest.Mock;
  };
  passkey: MockPasskey;
  request: ReturnType<typeof createMockRequest>;
}

function createHarness(
  passkey: MockPasskey | null = createMockPasskey(),
  newCounter = 5,
  userVerified = true,
): Harness {
  const passkeyModel = {
    findOne: jest.fn().mockResolvedValue(passkey),
  };

  const adapter = {
    createAuthenticationOptions: jest
      .fn()
      .mockResolvedValue({ challenge: 'challenge-value' }),
    verifyAssertion: jest.fn().mockResolvedValue({ newCounter, userVerified }),
  };

  const challenges = createChallengeService();
  const issued = createMockResponse();
  challenges.issue(issued.response, 'login', 'challenge-value');

  return {
    service: new PasskeyAssertionService(
      passkeyModel as unknown as ConstructorParameters<
        typeof PasskeyAssertionService
      >[0],
      adapter as unknown as WebAuthnAdapter,
      createPasskeyConfig(),
      challenges,
    ),
    adapter,
    passkey: passkey ?? createMockPasskey(),
    request: createMockRequest({
      [PASSKEY_CHALLENGE_COOKIE]: issued.cookies[PASSKEY_CHALLENGE_COOKIE],
    }),
  };
}

describe('PasskeyAssertionService', () => {
  describe('createOptions', () => {
    it('should ask for a discoverable credential and leave a challenge cookie', async () => {
      const harness = createHarness();
      const { response, cookies } = createMockResponse();

      const options = await harness.service.createOptions(response);

      expect(options.challenge).toBe('challenge-value');
      expect(cookies[PASSKEY_CHALLENGE_COOKIE]).toBeDefined();
      expect(harness.adapter.createAuthenticationOptions).toHaveBeenCalledWith({
        rpId: RP_ID,
        allowCredentials: [],
      });
    });
  });

  describe('verify', () => {
    it('should move the counter forward and stamp the passkey as used', async () => {
      const harness = createHarness();
      const { response, cleared } = createMockResponse();

      const result = await harness.service.verify(
        CREDENTIAL_BODY,
        harness.request,
        response,
      );

      expect(result.userVerified).toBe(true);
      expect(harness.passkey.counter).toBe(5);
      expect(harness.passkey.lastUsedAt).toEqual(expect.any(Date));
      expect(harness.passkey.save).toHaveBeenCalled();
      expect(cleared).toEqual([PASSKEY_CHALLENGE_COOKIE]);
    });

    it('should report a passkey that did not verify the user', async () => {
      const harness = createHarness(createMockPasskey(), 5, false);
      const { response } = createMockResponse();

      const result = await harness.service.verify(
        CREDENTIAL_BODY,
        harness.request,
        response,
      );

      expect(result.userVerified).toBe(false);
    });

    it('should refuse a counter that repeats, which is how a clone shows up', async () => {
      const harness = createHarness(createMockPasskey({ counter: 7 }), 7);
      const { response } = createMockResponse();

      await expect(
        harness.service.verify(CREDENTIAL_BODY, harness.request, response),
      ).rejects.toMatchObject({
        code: ErrorCode.PASSKEY_VERIFICATION_FAILED,
        status: 401,
      });
      expect(harness.passkey.save).not.toHaveBeenCalled();
    });

    it('should refuse a counter that goes backwards', async () => {
      const harness = createHarness(createMockPasskey({ counter: 9 }), 3);
      const { response } = createMockResponse();

      await expect(
        harness.service.verify(CREDENTIAL_BODY, harness.request, response),
      ).rejects.toMatchObject({ code: ErrorCode.PASSKEY_VERIFICATION_FAILED });
    });

    it('should let an authenticator that never counts through', async () => {
      const harness = createHarness(createMockPasskey({ counter: 0 }), 0);
      const { response } = createMockResponse();

      const result = await harness.service.verify(
        CREDENTIAL_BODY,
        harness.request,
        response,
      );

      expect(result.passkey.counter).toBe(0);
      expect(harness.passkey.save).toHaveBeenCalled();
    });

    it('should refuse a credential that is not registered', async () => {
      const harness = createHarness(null);
      const { response } = createMockResponse();

      await expect(
        harness.service.verify(CREDENTIAL_BODY, harness.request, response),
      ).rejects.toMatchObject({ code: ErrorCode.PASSKEY_VERIFICATION_FAILED });
    });

    it('should refuse an assertion whose signature does not check out', async () => {
      const harness = createHarness();
      harness.adapter.verifyAssertion.mockResolvedValue(null);
      const { response } = createMockResponse();

      await expect(
        harness.service.verify(CREDENTIAL_BODY, harness.request, response),
      ).rejects.toMatchObject({ code: ErrorCode.PASSKEY_VERIFICATION_FAILED });
    });

    it('should spend the challenge cookie even when the attempt fails', async () => {
      const harness = createHarness(null);
      const { response, cleared } = createMockResponse();

      await expect(
        harness.service.verify(CREDENTIAL_BODY, harness.request, response),
      ).rejects.toThrow();

      expect(cleared).toEqual([PASSKEY_CHALLENGE_COOKIE]);
    });

    it('should check the assertion against the stored credential', async () => {
      const harness = createHarness();
      const { response } = createMockResponse();

      await harness.service.verify(CREDENTIAL_BODY, harness.request, response);

      const stored = harness.adapter.verifyAssertion.mock.calls[0][1] as Record<
        string,
        unknown
      >;
      expect(stored.id).toBe(CREDENTIAL_ID);
      expect(stored.counter).toBe(4);
    });

    it('should refuse a sign-in that presents a registration challenge', async () => {
      const harness = createHarness();
      const challenges = createChallengeService();
      const issued = createMockResponse();
      challenges.issue(issued.response, 'register', 'challenge-value', 'user');
      const { response } = createMockResponse();

      await expect(
        harness.service.verify(
          CREDENTIAL_BODY,
          createMockRequest({
            [PASSKEY_CHALLENGE_COOKIE]:
              issued.cookies[PASSKEY_CHALLENGE_COOKIE],
          }),
          response,
        ),
      ).rejects.toMatchObject({ code: ErrorCode.PASSKEY_CHALLENGE_INVALID });
    });
  });
});
