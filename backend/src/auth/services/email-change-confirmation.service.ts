import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { User, UserDocument } from '../../user/schemas/user.schema';
import { ApiResponse } from '../../common/dto/api-response.dto';
import {
  hasErrorLabel,
  UNKNOWN_COMMIT_RESULT_LABEL,
  withMajorityTransaction,
} from '../../session/utils/mongo-transaction';
import { VerificationCodeService } from './verification-code.service';
import { confirmEmailChange } from '../utils/activation.util';
import { activationCodeInvalid } from '../utils/activation-error.util';
import { PENDING_PURPOSE } from '../constants/registration';
import { ReservedCode } from '../interfaces/pending-code.interface';
import { ConfirmEmailChangeDto } from '../dto/confirm-email-change.dto';

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
          session,
        );
        if (!consumed) {
          throw activationCodeInvalid();
        }
        await confirmEmailChange(reserved, this.userModel, session);
      });
    } catch (error) {
      if (!hasErrorLabel(error, UNKNOWN_COMMIT_RESULT_LABEL)) {
        throw error;
      }
      // The commit may have landed. Read this generation's verified state; a
      // landed commit answers success, otherwise the failure is real.
      if (!(await this.confirmedForGeneration(reserved))) {
        throw error;
      }
      this.logger.error(
        `Email change commit result unknown for user ${reserved.userId?.toString() ?? 'unknown'}`,
      );
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
