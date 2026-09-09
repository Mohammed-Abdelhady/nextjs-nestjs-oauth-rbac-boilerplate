import { HttpStatus, Injectable } from '@nestjs/common';
import { Request, Response } from 'express';
import { AppException } from '../../../common/exceptions/app.exception';
import { ErrorCode } from '../../../common/enums/error-code.enum';
import { UserDocument } from '../../../user/schemas/user.schema';
import { AuthFeature } from '../../enums/auth-feature.enum';
import { AuthFeaturesService } from '../../services/auth-features.service';
import { PasskeyCredentialDto } from '../dto/passkey-credential.dto';
import { PasskeyAssertionService } from './passkey-assertion.service';

/**
 * The part of a two-factor payload this verifier reads. Declared here rather
 * than imported from the second factor, which is what lets a project ship
 * passkeys without it.
 */
export interface PasskeySecondFactorPayload {
  passkeyResponse?: PasskeyCredentialDto;
}

/**
 * A passkey as the answer to a two-factor challenge. It proves possession of a
 * key the account registered, which is what a code from the authenticator app
 * proves as well.
 *
 * TwoFactorModule picks this up through its verifier registry; nothing here
 * knows about the second factor.
 */
@Injectable()
export class PasskeySecondFactorVerifier {
  constructor(
    private readonly authFeaturesService: AuthFeaturesService,
    private readonly assertions: PasskeyAssertionService,
  ) {}

  supports(dto: PasskeySecondFactorPayload): boolean {
    return dto.passkeyResponse !== undefined;
  }

  /**
   * The credential is checked against the passkey challenge cookie the client
   * picked up from POST /auth/passkeys/login/options, and has to belong to the
   * account the two-factor challenge was issued for.
   *
   * @throws AppException FEATURE_DISABLED when the deployment turned passkeys off
   * @throws AppException PASSKEY_VERIFICATION_FAILED when the credential
   * belongs to another account
   */
  async verify(
    dto: PasskeySecondFactorPayload,
    user: UserDocument,
    request: Request,
    response: Response,
  ): Promise<void> {
    this.authFeaturesService.assertEnabled(AuthFeature.PASSKEYS);

    if (!dto.passkeyResponse) {
      throw this.refused();
    }

    const { passkey } = await this.assertions.verify(
      dto.passkeyResponse,
      request,
      response,
    );

    if (passkey.user.toString() !== user._id.toString()) {
      throw this.refused();
    }
  }

  private refused(): AppException {
    return new AppException(
      ErrorCode.PASSKEY_VERIFICATION_FAILED,
      'That passkey could not be used to sign in',
      HttpStatus.UNAUTHORIZED,
    );
  }
}
