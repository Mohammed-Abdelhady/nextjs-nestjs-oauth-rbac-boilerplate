import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VerificationCodeService } from '../../../auth/services/codes/verification-code.service';
import { AuthMailService } from '../../../auth/services/mail/auth-mail.service';
import {
  ACTIVATION_CODE_EXPIRES_IN_DEFAULT,
  PENDING_PURPOSE,
  mailedCodeWindowMs,
} from '../../../auth/constants/registration';
import { AppException } from '../../../common/exceptions/app.exception';
import { ErrorCode } from '../../../common/enums/error-code.enum';
import { ADMIN_LEVEL } from '../../../common/utils/role-hierarchy';
import { StoredAccount } from '../../../user/stores/stored-account';
import {
  AddressMove,
  AdminAccountStore,
} from '../../stores/admin-account.store';

/**
 * Admin-initiated email changes.
 * Only admins may move an account to another address, and the account always
 * drops back to unverified until the new mailbox confirms the code.
 */
@Injectable()
export class AdminEmailChangeService {
  private readonly logger = new Logger(AdminEmailChangeService.name);
  private readonly retryMinutes: number;

  constructor(
    private readonly accounts: AdminAccountStore,
    private readonly verificationCodeService: VerificationCodeService,
    private readonly authMailService: AuthMailService,
    configService: ConfigService,
  ) {
    this.retryMinutes = Math.ceil(
      mailedCodeWindowMs(
        configService.get<number>(
          'activation.codeExpiresIn',
          ACTIVATION_CODE_EXPIRES_IN_DEFAULT,
        ),
      ) / 60000,
    );
  }

  /**
   * Prepare an account's move to a new address and mail a fresh verification
   * code. The pending record is bound to this user and the address generation
   * the move opens, so a later move supersedes it. Nothing is written to the
   * account here: the caller stores the move this returns, and a failed mail
   * returns none.
   *
   * @param user - The target account as it was read
   * @param email - New address
   * @param actorLevel - Hierarchy level of the acting admin
   * @throws AppException EMAIL_CHANGE_NOT_ALLOWED, EMAIL_ALREADY_EXISTS,
   * EMAIL_SEND_LIMIT_REACHED or EMAIL_SEND_FAILED
   */
  async apply(
    user: Pick<StoredAccount, 'id' | 'addressGeneration'>,
    email: string,
    actorLevel: number,
  ): Promise<AddressMove> {
    this.assertAdmin(actorLevel);

    if (await this.accounts.isAddressTaken(email)) {
      throw new AppException(
        ErrorCode.EMAIL_ALREADY_EXISTS,
        'Email already in use',
        HttpStatus.CONFLICT,
      );
    }

    const addressGeneration = user.addressGeneration + 1;
    const issued =
      await this.verificationCodeService.createOrUpdatePendingRegistration(
        email,
        PENDING_PURPOSE.EMAIL_CHANGE,
        { userId: user.id, addressGeneration },
      );

    if (!issued) {
      throw this.limitReached();
    }

    await this.sendCode(email, issued.code);

    return { email, addressGeneration, isVerified: false };
  }

  /**
   * Re-send the confirmation for the account's current unverified address.
   * Goes through the same refresh, so it gets a fresh code and resets the
   * attempt count, up to the per-address mail cap. Does not change the address
   * or the generation.
   *
   * @param user - The target account as it was read
   * @param actorLevel - Hierarchy level of the acting admin
   * @throws AppException EMAIL_CHANGE_NOT_ALLOWED, EMAIL_SEND_LIMIT_REACHED or
   * EMAIL_SEND_FAILED
   */
  async resend(
    user: Pick<
      StoredAccount,
      'id' | 'email' | 'isVerified' | 'addressGeneration'
    >,
    actorLevel: number,
  ): Promise<void> {
    this.assertAdmin(actorLevel);

    if (user.isVerified) {
      throw new AppException(
        ErrorCode.EMAIL_SEND_FAILED,
        'This account has no unverified address to confirm',
        HttpStatus.BAD_REQUEST,
      );
    }

    const issued =
      await this.verificationCodeService.createOrUpdatePendingRegistration(
        user.email,
        PENDING_PURPOSE.EMAIL_CHANGE,
        {
          userId: user.id,
          addressGeneration: user.addressGeneration,
        },
      );

    if (!issued) {
      throw this.limitReached();
    }

    await this.sendCode(user.email, issued.code);
  }

  private assertAdmin(actorLevel: number): void {
    if (actorLevel < ADMIN_LEVEL) {
      throw new AppException(
        ErrorCode.EMAIL_CHANGE_NOT_ALLOWED,
        'Only admins can change the email address of another account',
        HttpStatus.FORBIDDEN,
      );
    }
  }

  /** The per-address mail cap is in force; say when the address can retry. */
  private limitReached(): AppException {
    return new AppException(
      ErrorCode.EMAIL_SEND_LIMIT_REACHED,
      `Too many confirmation emails sent to this address; try again in ${this.retryMinutes} minutes`,
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private async sendCode(email: string, code: string): Promise<void> {
    // AuthMailService logs the failure with the request id and never the raw
    // transport message; the admin gets the shared send failure.
    const sent = await this.authMailService.sendEmailChangeCode(email, code);
    if (!sent) {
      this.logger.error('Email change confirmation was not handed over');
      throw new AppException(
        ErrorCode.EMAIL_SEND_FAILED,
        'Failed to send verification email',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
