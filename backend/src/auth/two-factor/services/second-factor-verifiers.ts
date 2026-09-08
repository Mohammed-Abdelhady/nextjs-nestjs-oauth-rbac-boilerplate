import { Request, Response } from 'express';
import { UserDocument } from '../../../user/schemas/user.schema';
import { VerifyTwoFactorDto } from '../dto/verify-two-factor.dto';

/** Multi-provider injection token holding every registered verifier. */
export const SECOND_FACTOR_VERIFIERS = 'SECOND_FACTOR_VERIFIERS';

/**
 * A way of answering a two-factor challenge that is not a code from the
 * authenticator app.
 *
 * Implementations live in the feature that owns the credential and are handed
 * to TwoFactorModule at registration, so this module never imports one. A
 * project scaffolded without that feature simply registers no verifier.
 */
export interface SecondFactorVerifier {
  /** True when the payload carries the credential this verifier checks. */
  supports(dto: VerifyTwoFactorDto): boolean;

  /**
   * @throws AppException when the credential does not answer the challenge, or
   * belongs to another account
   */
  verify(
    dto: VerifyTwoFactorDto,
    user: UserDocument,
    request: Request,
    response: Response,
  ): Promise<void>;
}
