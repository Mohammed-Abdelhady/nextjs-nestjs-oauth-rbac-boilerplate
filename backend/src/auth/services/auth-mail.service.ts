import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { MailService } from '../../mail/mail.service';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/enums/error-code.enum';

/**
 * Mail sent by the authentication flows.
 * A delivery failure becomes EMAIL_SEND_FAILED with the address kept out of
 * the response, so callers cannot read anything from a failed send.
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
  ): Promise<void> {
    await this.send(
      () => this.mailService.sendActivationCode(email, code, name),
      'Failed to send activation email',
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
  ): Promise<void> {
    await this.send(
      () => this.mailService.sendPasswordResetCode(email, code, name),
      'Failed to send password reset email',
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
  ): Promise<void> {
    await this.send(
      () => this.mailService.sendMagicLink(email, link, expiresInMinutes),
      'Failed to send sign-in link email',
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
  ): Promise<void> {
    await this.send(
      () => this.mailService.sendRegistrationAttemptNotice(email, name),
      'Failed to send registration notice email',
    );
  }

  private async send(
    action: () => Promise<void>,
    failureMessage: string,
  ): Promise<void> {
    try {
      await action();
    } catch (error) {
      this.logger.error(
        `${failureMessage}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new AppException(
        ErrorCode.EMAIL_SEND_FAILED,
        failureMessage,
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
