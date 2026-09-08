import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { UserDocument } from '../../../user/schemas/user.schema';
import { ErrorCode } from '../../../common/enums/error-code.enum';
import { AuthFeaturesService } from '../../services/auth-features.service';
import { PasskeyAssertionService } from './passkey-assertion.service';
import { PasskeySecondFactorVerifier } from './passkey-second-factor.verifier';
import {
  CREDENTIAL_BODY,
  OTHER_USER_ID,
  USER_ID,
} from '../passkeys.harness-spec';

const MOCK_REQUEST = { cookies: {} } as unknown as Request;
const MOCK_RESPONSE = {} as unknown as Response;
const USER = { _id: USER_ID } as unknown as UserDocument;

interface Harness {
  verifier: PasskeySecondFactorVerifier;
  assertions: { verify: jest.Mock };
}

function createHarness(
  passkeyOwner: Types.ObjectId = USER_ID,
  passkeysEnabled = true,
): Harness {
  const assertions = {
    verify: jest.fn().mockResolvedValue({
      passkey: { user: passkeyOwner },
      userVerified: true,
    }),
  };

  const authFeaturesService = new AuthFeaturesService({
    get: jest.fn((key: string, fallback?: boolean) =>
      key === 'passkeys.enabled' ? passkeysEnabled : fallback,
    ),
  } as unknown as ConstructorParameters<typeof AuthFeaturesService>[0]);

  return {
    verifier: new PasskeySecondFactorVerifier(
      authFeaturesService,
      assertions as unknown as PasskeyAssertionService,
    ),
    assertions,
  };
}

describe('PasskeySecondFactorVerifier', () => {
  it('should claim a payload carrying a credential, and nothing else', () => {
    const { verifier } = createHarness();

    expect(verifier.supports({ passkeyResponse: CREDENTIAL_BODY })).toBe(true);
    expect(verifier.supports({})).toBe(false);
  });

  it('should accept a credential registered to the account', async () => {
    const harness = createHarness();

    await harness.verifier.verify(
      { passkeyResponse: CREDENTIAL_BODY },
      USER,
      MOCK_REQUEST,
      MOCK_RESPONSE,
    );

    expect(harness.assertions.verify).toHaveBeenCalledWith(
      CREDENTIAL_BODY,
      MOCK_REQUEST,
      MOCK_RESPONSE,
    );
  });

  it('should refuse a credential registered to another account', async () => {
    const harness = createHarness(OTHER_USER_ID);

    await expect(
      harness.verifier.verify(
        { passkeyResponse: CREDENTIAL_BODY },
        USER,
        MOCK_REQUEST,
        MOCK_RESPONSE,
      ),
    ).rejects.toMatchObject({
      code: ErrorCode.PASSKEY_VERIFICATION_FAILED,
      status: 401,
    });
  });

  it('should refuse anything while the method is off', async () => {
    const harness = createHarness(USER_ID, false);

    await expect(
      harness.verifier.verify(
        { passkeyResponse: CREDENTIAL_BODY },
        USER,
        MOCK_REQUEST,
        MOCK_RESPONSE,
      ),
    ).rejects.toMatchObject({
      code: ErrorCode.FEATURE_DISABLED,
      status: 404,
    });

    expect(harness.assertions.verify).not.toHaveBeenCalled();
  });

  it('should refuse a payload with no credential in it', async () => {
    const harness = createHarness();

    await expect(
      harness.verifier.verify({}, USER, MOCK_REQUEST, MOCK_RESPONSE),
    ).rejects.toMatchObject({ code: ErrorCode.PASSKEY_VERIFICATION_FAILED });

    expect(harness.assertions.verify).not.toHaveBeenCalled();
  });
});
