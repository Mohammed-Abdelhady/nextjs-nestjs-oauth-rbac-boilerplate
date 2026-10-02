import { Injectable, Logger } from '@nestjs/common';
import { MailService } from '../../mail/mail.service';
import { currentRequestId } from '../../common/context/request-context';
import {
  ACTIVATION_EMAIL_FAILED_MESSAGE,
  PASSWORD_RESET_EMAIL_FAILED_MESSAGE,
  REGISTRATION_NOTICE_EMAIL_FAILED_MESSAGE,
  SIGN_IN_LINK_EMAIL_FAILED_MESSAGE,
} from '../constants/auth-messages';

/**
 * Logs a delivery failure and drops it, so a known and an unknown address get
 * the same answer.
 */
@Injectable()
export class AuthMailService {
  private readonly logger = new Logger(AuthMailService.name);

  constructor(private readonly mailService: MailService) {}

  /**
   * Mail an activation code.
   *
   * @param email - Recipient address
   * @param code - 6-digit activation code
   * @param name - Name stored with the pending registration
   */
  async sendActivationCode(
    email: string,
    code: string,
    name: string,
  ): Promise<boolean> {
    return this.send(
      () => this.mailService.sendActivationCode(email, code, name),
      ACTIVATION_EMAIL_FAILED_MESSAGE,
    );
  }

  /**
   * Mail a password reset code.
   *
   * @param email - Recipient address
   * @param code - 6-digit reset code
   * @param name - Account holder name
   */
  async sendPasswordResetCode(
    email: string,
    code: string,
    name: string,
  ): Promise<boolean> {
    return this.send(
      () => this.mailService.sendPasswordResetCode(email, code, name),
      PASSWORD_RESET_EMAIL_FAILED_MESSAGE,
    );
  }

  /**
   * Mail a one-time sign-in link.
   *
   * @param email - Recipient address
   * @param link - Client URL carrying the token
   * @param expiresInMinutes - Minutes until the link stops working
   */
  async sendMagicLink(
    email: string,
    link: string,
    expiresInMinutes: number,
  ): Promise<boolean> {
    return this.send(
      () => this.mailService.sendMagicLink(email, link, expiresInMinutes),
      SIGN_IN_LINK_EMAIL_FAILED_MESSAGE,
    );
  }

  /**
   * Tell an account holder that their address was used in a registration.
   *
   * @param email - Recipient address
   * @param name - Account holder name
   */
  async sendRegistrationAttemptNotice(
    email: string,
    name: string,
  ): Promise<boolean> {
    return this.send(
      () => this.mailService.sendRegistrationAttemptNotice(email, name),
      REGISTRATION_NOTICE_EMAIL_FAILED_MESSAGE,
    );
  }

  /** True when the mail was handed over, false when a failure was dropped. */
  private async send(
    action: () => Promise<void>,
    failureMessage: string,
  ): Promise<boolean> {
    try {
      await action();
      return true;
    } catch (error) {
      const requestId = currentRequestId() ?? 'unknown';
      const cause = error instanceof Error ? error.name : typeof error;
      this.logger.error(
        `${failureMessage} requestId=${requestId} cause=${cause}`,
      );
      return false;
    }
  }
}
