import { Injectable, Logger } from '@nestjs/common';
import { ApiResponse } from '../../../common/dto/api-response.dto';
import { isUnknownTransactionOutcome } from '../../../common/exceptions/unknown-transaction-outcome.error';
import { storeFailureCause } from '../../../common/persistence/store-failure';
import { UnitOfWorkRunner } from '../../../common/persistence/unit-of-work';
import { ActivationAccounts } from '../../pending-codes/activation-accounts';
import { VerificationCodeService } from '../codes/verification-code.service';
import { confirmEmailChange } from '../../utils/activation.util';
import { activationCodeInvalid } from '../../utils/activation-error.util';
import { PENDING_PURPOSE } from '../../constants/registration';
import { ReservedCode } from '../../interfaces/pending-code.interface';
import { ConfirmEmailChangeDto } from '../../dto/confirm-email-change.dto';
import { logUnknownCommit } from '../../utils/unknown-commit.util';
import { asAuthorityUnavailable } from '../../../session/utils/authority/authority-unavailable';

/**
 * Confirms the new address an admin moved an account to. It is its own
 * operation: no password is involved, no session is issued, and the record
 * must still match the user and the address generation it was issued under.
 */
@Injectable()
export class EmailChangeConfirmationService {
  private readonly logger = new Logger(EmailChangeConfirmationService.name);

  constructor(
    private readonly accounts: ActivationAccounts,
    private readonly runner: UnitOfWorkRunner,
    private readonly verificationCodeService: VerificationCodeService,
  ) {}

  async confirm(
    dto: ConfirmEmailChangeDto,
  ): Promise<ApiResponse<{ message: string }>> {
    const reserved = await this.verificationCodeService.verifyCode(
      dto.email,
      dto.code,
      PENDING_PURPOSE.EMAIL_CHANGE,
    );

    try {
      await this.runner.run(async (unitOfWork) => {
        const consumed = await this.verificationCodeService.consumeCode(
          reserved,
          unitOfWork,
        );
        if (!consumed) {
          throw activationCodeInvalid();
        }
        await confirmEmailChange(this.accounts, unitOfWork, reserved);
      });
    } catch (error) {
      if (!isUnknownTransactionOutcome(error)) {
        throw storeFailureCause(error);
      }
      // The commit may have landed. Only a verified generation answers
      // success; an absent or unreadable row remains an unknown outcome.
      let confirmed: boolean;
      try {
        confirmed = await this.confirmedForGeneration(reserved);
      } catch {
        logUnknownCommit(this.logger, 'Email change', error);
        asAuthorityUnavailable(error);
      }
      if (!confirmed) {
        asAuthorityUnavailable(error);
      }
      logUnknownCommit(this.logger, 'Email change', error);
    }

    return ApiResponse.success({
      message: 'Email address confirmed. Sign in to continue.',
    });
  }

  /** True when this generation's address is already marked verified. */
  private async confirmedForGeneration(
    reserved: ReservedCode,
  ): Promise<boolean> {
    if (!reserved.userId) {
      return false;
    }
    const user = await this.accounts.findAddressConfirmation(
      reserved.userId.toString(),
    );
    return (
      user !== null &&
      user.isVerified &&
      user.addressGeneration === (reserved.addressGeneration ?? 0)
    );
  }
}
