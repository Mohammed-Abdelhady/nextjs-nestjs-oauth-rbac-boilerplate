import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Request, Response } from 'express';
import { User, UserDocument } from '../../../user/schemas/user.schema';
import { ApiResponse } from '../../../common/dto/api-response.dto';
import { AppException } from '../../../common/exceptions/app.exception';
import { ErrorCode } from '../../../common/enums/error-code.enum';
import { LoginResponseDto } from '../../dto/login-response.dto';
import { SignInService } from '../../services/sign-in.service';
import { VerifyPasskeyLoginDto } from '../dto/verify-passkey-login.dto';
import { PasskeyAssertionService } from './passkey-assertion.service';
import { PasskeyRequestOptions } from './webauthn.adapter';

/**
 * Signing in with a passkey and nothing else.
 *
 * A passkey that verified the user, with a PIN or a biometric, has already
 * collected two factors in one gesture: the key on the device and something
 * only its owner can supply. That sign-in is let through even on an account
 * with TOTP on, which is the behaviour WebAuthn is designed for and matches
 * what the platforms do. A passkey that only proved possession, silent or
 * usernameless without user verification, still owes the TOTP code.
 */
@Injectable()
export class PasskeyLoginService {
  private readonly logger = new Logger(PasskeyLoginService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly assertions: PasskeyAssertionService,
    private readonly signInService: SignInService,
  ) {}

  async createOptions(
    response: Response,
  ): Promise<ApiResponse<PasskeyRequestOptions>> {
    return ApiResponse.success(await this.assertions.createOptions(response));
  }

  /**
   * @throws AppException PASSKEY_VERIFICATION_FAILED when the assertion fails,
   * or the account behind the credential is gone
   */
  async verify(
    dto: VerifyPasskeyLoginDto,
    request: Request,
    response: Response,
  ): Promise<ApiResponse<LoginResponseDto>> {
    const { passkey, userVerified } = await this.assertions.verify(
      dto.response,
      request,
      response,
    );

    const user = await this.userModel.findById(passkey.user);

    if (!user || user.isDeleted) {
      throw new AppException(
        ErrorCode.PASSKEY_VERIFICATION_FAILED,
        'That passkey could not be used to sign in',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (userVerified) {
      const summary = await this.signInService.issueSession(user, response);
      this.logger.log(`Passkey sign-in with user verification: ${user.email}`);
      return LoginResponseDto.success(summary);
    }

    const outcome = await this.signInService.completeSignIn(user, response);

    if (outcome.requiresTwoFactor) {
      this.logger.log(`Passkey accepted, second factor owed: ${user.email}`);
      return LoginResponseDto.twoFactorRequired();
    }

    this.logger.log(`Passkey sign-in: ${user.email}`);
    return LoginResponseDto.success(outcome.user);
  }
}
