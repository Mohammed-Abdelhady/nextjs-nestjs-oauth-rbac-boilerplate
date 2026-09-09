import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../../user/schemas/user.schema';
import { VerificationCodeService } from '../../auth/services/verification-code.service';
import { MailService } from '../../mail/mail.service';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/enums/error-code.enum';
import { ADMIN_LEVEL } from '../../common/utils/role-hierarchy';

/**
 * Admin-initiated email changes.
 * Only admins may move an account to another address, and the account always
 * drops back to unverified until the new mailbox confirms the code.
 */
@Injectable()
export class AdminEmailChangeService {
  private readonly logger = new Logger(AdminEmailChangeService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly verificationCodeService: VerificationCodeService,
    private readonly mailService: MailService,
  ) {}

  /**
   * Point an account at a new address and mail a fresh verification code.
   * The caller saves the document; nothing is persisted if the mail fails.
   *
   * @param user - Target user document, mutated in place
   * @param email - New address
   * @param actorLevel - Hierarchy level of the acting admin
   * @throws AppException EMAIL_CHANGE_NOT_ALLOWED, EMAIL_ALREADY_EXISTS or
   * EMAIL_SEND_FAILED
   */
  async apply(
    user: UserDocument,
    email: string,
    actorLevel: number,
  ): Promise<void> {
    if (actorLevel < ADMIN_LEVEL) {
      throw new AppException(
        ErrorCode.EMAIL_CHANGE_NOT_ALLOWED,
        'Only admins can change the email address of another account',
        HttpStatus.FORBIDDEN,
      );
    }

    const taken = await this.userModel
      .findOne({ email: { $eq: email } })
      .exec();
    if (taken) {
      throw new AppException(
        ErrorCode.EMAIL_ALREADY_EXISTS,
        'Email already in use',
        HttpStatus.CONFLICT,
      );
    }

    const { code } =
      await this.verificationCodeService.createOrUpdatePendingRegistration(
        email,
        user.name,
      );

    await this.sendCode(email, code, user.name);

    user.email = email;
    user.isVerified = false;
  }

  private async sendCode(
    email: string,
    code: string,
    name: string,
  ): Promise<void> {
    try {
      await this.mailService.sendActivationCode(email, code, name);
    } catch (error) {
      this.logger.error(
        `Failed to send verification code to ${email}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw new AppException(
        ErrorCode.EMAIL_SEND_FAILED,
        'Failed to send verification email',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
