import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { User, UserDocument } from '../../../user/schemas/user.schema';
import { ApiResponse } from '../../../common/dto/api-response.dto';
import {
  isUnknownTransactionOutcome,
  withMajorityTransaction,
} from '../../../session/utils/transactions/mongo-transaction';
import { VerificationCodeService } from '../codes/verification-code.service';
import { confirmEmailChange } from '../../utils/activation.util';
import { activationCodeInvalid } from '../../utils/activation-error.util';
import { PENDING_PURPOSE } from '../../constants/registration';
import { ReservedCode } from '../../interfaces/pending-code.interface';
import { ConfirmEmailChangeDto } from '../../dto/confirm-email-change.dto';
import { logUnknownCommit } from '../../utils/unknown-commit.util';
import { asAuthorityUnavailable } from '../../../session/utils/authority/authority-unavailable';
import { mongoUnitOfWork } from '../../../session/persistence/mongo/mongo-unit-of-work';

/**
 * Confirms the new address an admin moved an account to. It is its own
 * operation: no password is involved, no session is issued, and the record
 * must still match the user and the address generation it was issued under.
 */
@Injectable()
export class EmailChangeConfirmationService {
  private readonly logger = new Logger(EmailChangeConfirmationService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectConnection() private readonly connection: Connection,
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
      await withMajorityTransaction(this.connection, async (session) => {
        const consumed = await this.verificationCodeService.consumeCode(
          reserved,
          mongoUnitOfWork(session),
        );
        if (!consumed) {
          throw activationCodeInvalid();
        }
        await confirmEmailChange(reserved, this.userModel, session);
      });
    } catch (error) {
      if (!isUnknownTransactionOutcome(error)) {
        throw error;
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
    const user = await this.userModel.findById(reserved.userId);
    return (
      user !== null &&
      user.isVerified === true &&
      (user.addressGeneration ?? 0) === (reserved.addressGeneration ?? 0)
    );
  }
}
