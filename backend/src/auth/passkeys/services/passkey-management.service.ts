import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../../../user/schemas/user.schema';
import { ApiResponse } from '../../../common/dto/api-response.dto';
import { AppException } from '../../../common/exceptions/app.exception';
import { ErrorCode } from '../../../common/enums/error-code.enum';
import { AuthFeature } from '../../enums/auth-feature.enum';
import { AuthFeaturesService } from '../../services/auth-features.service';
import { Passkey, PasskeyDocument } from '../schemas/passkey.schema';
import {
  PasskeyListResponseDto,
  PasskeySummaryDto,
} from '../dto/passkey-summary.dto';
import { RenamePasskeyDto } from '../dto/rename-passkey.dto';
import { toPasskeySummary } from '../utils/passkey-summary.util';

/**
 * The passkeys on an account, from the account settings. Every lookup is
 * scoped to the signed-in user, so an id belonging to someone else reads as
 * absent rather than as forbidden.
 */
@Injectable()
export class PasskeyManagementService {
  private readonly logger = new Logger(PasskeyManagementService.name);

  constructor(
    @InjectModel(Passkey.name)
    private readonly passkeyModel: Model<PasskeyDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly authFeaturesService: AuthFeaturesService,
  ) {}

  async list(userId: string): Promise<ApiResponse<PasskeyListResponseDto>> {
    const passkeys = await this.passkeyModel
      .find({ user: userId })
      .sort({ createdAt: -1 });

    return ApiResponse.success({ passkeys: passkeys.map(toPasskeySummary) });
  }

  /** @throws AppException PASSKEY_NOT_FOUND when the account has no such passkey */
  async rename(
    userId: string,
    passkeyId: string,
    dto: RenamePasskeyDto,
  ): Promise<ApiResponse<PasskeySummaryDto>> {
    const passkey = await this.findOwned(userId, passkeyId);

    passkey.name = dto.name.trim();
    await passkey.save();

    return ApiResponse.success(toPasskeySummary(passkey), 'Passkey renamed');
  }

  /**
   * @throws AppException PASSKEY_NOT_FOUND when the account has no such passkey
   * @throws AppException PASSKEY_LAST_SIGN_IN_METHOD when removing it would
   * lock the account out
   */
  async remove(
    userId: string,
    passkeyId: string,
  ): Promise<ApiResponse<{ message: string }>> {
    const passkey = await this.findOwned(userId, passkeyId);
    await this.assertNotTheLastWayIn(userId);

    await this.passkeyModel.deleteOne({ _id: passkey._id });

    this.logger.log(`Passkey removed for user ${userId}`);
    return ApiResponse.success({ message: 'Passkey removed' });
  }

  private async findOwned(
    userId: string,
    passkeyId: string,
  ): Promise<PasskeyDocument> {
    const passkey = await this.passkeyModel.findOne({
      _id: passkeyId,
      user: userId,
    });

    if (!passkey) {
      throw new AppException(
        ErrorCode.PASSKEY_NOT_FOUND,
        'Passkey not found',
        HttpStatus.NOT_FOUND,
      );
    }

    return passkey;
  }

  /**
   * The last passkey stays when it is the only way into the account: no second
   * passkey, no password to sign in with, no linked OAuth account, and no
   * magic link. Any one of those, and the passkey goes.
   */
  private async assertNotTheLastWayIn(userId: string): Promise<void> {
    const remaining = await this.passkeyModel.countDocuments({ user: userId });

    if (remaining > 1) {
      return;
    }

    const user = await this.userModel.findById(userId).select('+password');

    if (!user) {
      return;
    }

    const hasPassword =
      this.authFeaturesService.isEnabled(AuthFeature.PASSWORD) &&
      Boolean(user.password);
    const hasOAuth = (user.linkedAccounts ?? []).length > 0;
    const hasMagicLink = this.authFeaturesService.isEnabled(
      AuthFeature.MAGIC_LINK,
    );

    if (hasPassword || hasOAuth || hasMagicLink) {
      return;
    }

    throw new AppException(
      ErrorCode.PASSKEY_LAST_SIGN_IN_METHOD,
      'This is the only way to sign in to the account. Add a password or ' +
        'another passkey first.',
      HttpStatus.CONFLICT,
    );
  }
}
