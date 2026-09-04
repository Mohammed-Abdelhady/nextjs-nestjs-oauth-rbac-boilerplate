import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../../user/schemas/user.schema';
import {
  assertActiveUser,
  assertValidObjectId,
} from '../../user/utils/user-lookup.util';
import { ApiResponse } from '../../common/dto/api-response.dto';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/enums/error-code.enum';
import { SetupTwoFactorDto } from './dto/setup-two-factor.dto';
import { TwoFactorCodeDto } from './dto/two-factor-code.dto';
import { DisableTwoFactorDto } from './dto/disable-two-factor.dto';
import { TwoFactorSetupResponseDto } from './dto/two-factor-setup-response.dto';
import { RecoveryCodesResponseDto } from './dto/recovery-codes-response.dto';
import { TotpSecretCryptoService } from './services/totp-secret-crypto.service';
import { TwoFactorVerificationService } from './services/two-factor-verification.service';
import {
  SessionAge,
  TwoFactorReauthService,
} from './services/two-factor-reauth.service';
import { buildOtpauthUrl, generateTotpSecret } from './utils/totp.util';
import {
  generateRecoveryCodes,
  hashRecoveryCode,
} from './utils/recovery-code.util';

/**
 * Managing the second factor on an account that is already signed in: turning
 * it on, turning it off, and replacing the recovery codes.
 */
@Injectable()
export class TwoFactorService {
  private readonly logger = new Logger(TwoFactorService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly cryptoService: TotpSecretCryptoService,
    private readonly verificationService: TwoFactorVerificationService,
    private readonly reauthService: TwoFactorReauthService,
  ) {}

  /**
   * Store an unconfirmed secret and hand back the URL for the app. Nothing
   * about how the account signs in changes until confirm succeeds.
   *
   * @throws AppException TWO_FACTOR_ALREADY_ENABLED when a confirmed secret is
   * already in place
   */
  async setup(
    userId: string,
    dto: SetupTwoFactorDto,
    session: SessionAge | undefined,
  ): Promise<ApiResponse<TwoFactorSetupResponseDto>> {
    const user = await this.loadUser(userId, true);
    this.assertNotEnabled(user);
    await this.reauthService.assertReauthenticated(user, dto.password, session);

    const secret = generateTotpSecret();
    user.twoFactor = {
      enabled: false,
      secret: this.cryptoService.encrypt(secret),
      confirmedAt: null,
      recoveryCodes: [],
      lastUsedStep: null,
    };
    await user.save();

    this.logger.log(`Two-factor setup started for ${user.email}`);
    return TwoFactorSetupResponseDto.success(
      buildOtpauthUrl(user.email, secret),
      secret,
    );
  }

  /**
   * Turn the second factor on with a first correct code, and hand out the
   * recovery codes. This is the only time they are readable.
   *
   * @throws AppException TWO_FACTOR_SETUP_REQUIRED when setup did not run
   */
  async confirm(
    userId: string,
    dto: TwoFactorCodeDto,
  ): Promise<ApiResponse<RecoveryCodesResponseDto>> {
    const user = await this.loadUser(userId);
    this.assertNotEnabled(user);

    if (!user.twoFactor?.secret) {
      throw new AppException(
        ErrorCode.TWO_FACTOR_SETUP_REQUIRED,
        'Start setup before confirming a code',
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.verificationService.verifyTotpCode(user, dto.code);

    const codes = this.replaceRecoveryCodes(user);
    user.twoFactor.enabled = true;
    user.twoFactor.confirmedAt = new Date();
    await user.save();

    this.logger.log(`Two-factor enabled for ${user.email}`);
    return RecoveryCodesResponseDto.success(
      codes,
      'Store these codes somewhere safe. They are not shown again.',
    );
  }

  /**
   * Turn the second factor off. Needs a code or a recovery code, and the
   * password as well when the account has one.
   */
  async disable(
    userId: string,
    dto: DisableTwoFactorDto,
  ): Promise<ApiResponse<{ message: string }>> {
    const user = await this.loadUser(userId, true);
    this.assertEnabled(user);
    await this.reauthService.assertPasswordIfSet(user, dto.password);
    await this.verificationService.verifySecondFactor(user, dto);

    user.twoFactor = {
      enabled: false,
      secret: null,
      confirmedAt: null,
      recoveryCodes: [],
      lastUsedStep: null,
    };
    await user.save();

    this.logger.log(`Two-factor disabled for ${user.email}`);
    return ApiResponse.success({
      message: 'Two-factor authentication is off',
    });
  }

  /**
   * Replace the recovery codes with a fresh batch. Every code from the old
   * batch stops working, used or not.
   */
  async regenerateRecoveryCodes(
    userId: string,
    dto: TwoFactorCodeDto,
  ): Promise<ApiResponse<RecoveryCodesResponseDto>> {
    const user = await this.loadUser(userId);
    this.assertEnabled(user);
    await this.verificationService.verifyTotpCode(user, dto.code);

    const codes = this.replaceRecoveryCodes(user);
    await user.save();

    this.logger.log(`Recovery codes replaced for ${user.email}`);
    return RecoveryCodesResponseDto.success(
      codes,
      'The codes from before no longer work.',
    );
  }

  private replaceRecoveryCodes(user: UserDocument): string[] {
    const codes = generateRecoveryCodes();
    user.twoFactor.recoveryCodes = codes.map((code) => ({
      hash: hashRecoveryCode(code),
      usedAt: null,
    }));
    user.markModified('twoFactor.recoveryCodes');
    return codes;
  }

  private async loadUser(
    userId: string,
    withPassword = false,
  ): Promise<UserDocument> {
    assertValidObjectId(userId, 'Invalid user ID format');

    const query = this.userModel.findById(userId);
    const user = await (
      withPassword ? query.select('+password') : query
    ).exec();

    assertActiveUser(user);
    return user;
  }

  private assertNotEnabled(user: UserDocument): void {
    if (!user.twoFactor?.enabled) {
      return;
    }

    throw new AppException(
      ErrorCode.TWO_FACTOR_ALREADY_ENABLED,
      'Two-factor authentication is already on. Turn it off first.',
      HttpStatus.CONFLICT,
    );
  }

  private assertEnabled(user: UserDocument): void {
    if (user.twoFactor?.enabled) {
      return;
    }

    throw new AppException(
      ErrorCode.TWO_FACTOR_NOT_ENABLED,
      'Two-factor authentication is not on for this account',
      HttpStatus.BAD_REQUEST,
    );
  }
}
