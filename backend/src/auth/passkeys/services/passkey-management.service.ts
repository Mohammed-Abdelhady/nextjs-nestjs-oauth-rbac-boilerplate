import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ApiResponse } from '../../../common/dto/api-response.dto';
import { AppException } from '../../../common/exceptions/app.exception';
import { ErrorCode } from '../../../common/enums/error-code.enum';
import {
  UnitOfWork,
  UnitOfWorkRunner,
} from '../../../common/persistence/unit-of-work';
import { AuthFeature } from '../../enums/auth-feature.enum';
import { AuthFeaturesService } from '../../services/features/auth-features.service';
import {
  PasskeyListResponseDto,
  PasskeySummaryDto,
} from '../dto/passkey-summary.dto';
import { RenamePasskeyDto } from '../dto/rename-passkey.dto';
import { toPasskeySummary } from '../utils/passkey-summary.util';
import { PasskeyAccounts } from '../stores/passkey-accounts';
import { PasskeyStore, StoredPasskey } from '../stores/passkey.store';

/**
 * The passkeys on an account, from the account settings. Every lookup is
 * scoped to the signed-in user, so an id belonging to someone else reads as
 * absent rather than as forbidden.
 */
@Injectable()
export class PasskeyManagementService {
  private readonly logger = new Logger(PasskeyManagementService.name);

  constructor(
    private readonly passkeys: PasskeyStore,
    private readonly accounts: PasskeyAccounts,
    private readonly authFeaturesService: AuthFeaturesService,
    private readonly runner: UnitOfWorkRunner,
  ) {}

  async list(userId: string): Promise<ApiResponse<PasskeyListResponseDto>> {
    const passkeys = await this.passkeys.listForAccount(userId);

    return ApiResponse.success({ passkeys: passkeys.map(toPasskeySummary) });
  }

  /** @throws AppException PASSKEY_NOT_FOUND when the account has no such passkey */
  async rename(
    userId: string,
    passkeyId: string,
    dto: RenamePasskeyDto,
  ): Promise<ApiResponse<PasskeySummaryDto>> {
    const passkey = await this.findOwned(userId, passkeyId);
    const renamed = await this.passkeys.rename(passkey, dto.name.trim());

    return ApiResponse.success(toPasskeySummary(renamed), 'Passkey renamed');
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
    // The count and the removal commit or abort together, so two removals at
    // once cannot each count the other's passkey as the one that stays.
    await this.runner.run(async (unitOfWork) => {
      await this.assertNotTheLastWayIn(unitOfWork, userId);
      await this.passkeys.remove(unitOfWork, passkey);
    });

    this.logger.log(`Passkey removed for user ${userId}`);
    return ApiResponse.success({ message: 'Passkey removed' });
  }

  private async findOwned(
    userId: string,
    passkeyId: string,
  ): Promise<StoredPasskey> {
    const passkey = await this.passkeys.findOwned(userId, passkeyId);

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
  private async assertNotTheLastWayIn(
    unitOfWork: UnitOfWork,
    userId: string,
  ): Promise<void> {
    const remaining = await this.passkeys.holdForAccount(unitOfWork, userId);

    if (remaining > 1) {
      return;
    }

    const stored = await this.accounts.findSignInMethods(userId);

    if (!stored) {
      return;
    }

    const hasPassword =
      this.authFeaturesService.isEnabled(AuthFeature.PASSWORD) &&
      stored.hasPassword;
    const hasOAuth = stored.hasLinkedAccount;
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
