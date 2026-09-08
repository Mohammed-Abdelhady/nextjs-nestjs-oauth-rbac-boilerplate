import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Request, Response } from 'express';
import { User, UserDocument } from '../../../user/schemas/user.schema';
import { ApiResponse } from '../../../common/dto/api-response.dto';
import { AppException } from '../../../common/exceptions/app.exception';
import { ErrorCode } from '../../../common/enums/error-code.enum';
import { Passkey, PasskeyDocument } from '../schemas/passkey.schema';
import { PasskeySummaryDto } from '../dto/passkey-summary.dto';
import { VerifyPasskeyRegistrationDto } from '../dto/verify-passkey-registration.dto';
import { toPasskeySummary } from '../utils/passkey-summary.util';
import { PasskeyChallengeService } from './passkey-challenge.service';
import { PasskeyConfigService } from './passkey-config.service';
import { PasskeyCreationOptions, WebAuthnAdapter } from './webauthn.adapter';
import { PASSKEY_DEFAULT_NAME } from '../constants/passkeys.constants';

/**
 * Adding a passkey to an account that is already signed in. The challenge the
 * authenticator signs over is handed out by the options route and checked by
 * the verify route, so a response captured elsewhere cannot be replayed here.
 */
@Injectable()
export class PasskeyRegistrationService {
  private readonly logger = new Logger(PasskeyRegistrationService.name);

  constructor(
    @InjectModel(Passkey.name)
    private readonly passkeyModel: Model<PasskeyDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly adapter: WebAuthnAdapter,
    private readonly config: PasskeyConfigService,
    private readonly challenges: PasskeyChallengeService,
  ) {}

  /**
   * Options for navigator.credentials.create(). Credentials already on the
   * account are excluded, so an authenticator that holds one says so instead
   * of registering a second.
   */
  async createOptions(
    userId: string,
    response: Response,
  ): Promise<ApiResponse<PasskeyCreationOptions>> {
    const user = await this.userModel.findById(userId);

    if (!user || user.isDeleted) {
      throw new AppException(
        ErrorCode.USER_NOT_FOUND,
        'User not found',
        HttpStatus.NOT_FOUND,
      );
    }

    const existing = await this.passkeyModel
      .find({ user: user._id })
      .select('credentialId transports');

    const options = await this.adapter.createRegistrationOptions({
      rpId: this.config.rpId,
      rpName: this.config.rpName,
      userId: user._id.toString(),
      userName: user.email,
      userDisplayName: user.name,
      excludeCredentials: existing.map((passkey) => ({
        id: passkey.credentialId,
        transports: passkey.transports,
      })),
    });

    this.challenges.issue(
      response,
      'register',
      options.challenge,
      user._id.toString(),
    );

    return ApiResponse.success(options);
  }

  /**
   * @throws AppException PASSKEY_CHALLENGE_INVALID when the cookie belongs to
   * another account or another ceremony
   * @throws AppException PASSKEY_VERIFICATION_FAILED when the attestation does
   * not check out, or the credential is already registered
   */
  async verify(
    userId: string,
    dto: VerifyPasskeyRegistrationDto,
    request: Request,
    response: Response,
  ): Promise<ApiResponse<PasskeySummaryDto>> {
    const challenge = this.challenges.read(request, 'register');
    // Spent before it is used, so a failed attempt cannot be retried against
    // the same challenge whichever way the attempt fails.
    this.challenges.clear(response);

    if (challenge.sub !== userId) {
      throw new AppException(
        ErrorCode.PASSKEY_CHALLENGE_INVALID,
        'This passkey attempt is no longer valid. Start again.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const verified = await this.adapter.verifyAttestation(
      dto.response,
      this.config.expectations(challenge.challenge),
    );

    if (!verified) {
      throw this.verificationFailed('attestation did not verify');
    }

    if (
      await this.passkeyModel.exists({ credentialId: verified.credentialId })
    ) {
      throw this.verificationFailed('credential is already registered');
    }

    const passkey = await this.passkeyModel.create({
      user: challenge.sub,
      credentialId: verified.credentialId,
      publicKey: verified.publicKey,
      counter: verified.counter,
      transports: verified.transports,
      deviceType: verified.deviceType,
      backedUp: verified.backedUp,
      name: dto.name?.trim() || PASSKEY_DEFAULT_NAME,
      lastUsedAt: null,
    });

    this.logger.log(`Passkey registered for user ${userId}`);
    return ApiResponse.success(toPasskeySummary(passkey), 'Passkey added');
  }

  private verificationFailed(reason: string): AppException {
    this.logger.warn(`Passkey registration refused: ${reason}`);
    return new AppException(
      ErrorCode.PASSKEY_VERIFICATION_FAILED,
      'That passkey could not be registered',
      HttpStatus.UNAUTHORIZED,
    );
  }
}
