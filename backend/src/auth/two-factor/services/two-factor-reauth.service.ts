import { HttpStatus, Injectable } from '@nestjs/common';
import { UserDocument } from '../../../user/schemas/user.schema';
import { HashService } from '../../../common/services/hash.service';
import { AppException } from '../../../common/exceptions/app.exception';
import { ErrorCode } from '../../../common/enums/error-code.enum';
import { TWO_FACTOR_FRESH_SESSION_MS } from '../constants/two-factor.constants';

/** Enough of a session for the freshness check. */
export interface SessionAge {
  createdAt: Date;
}

/**
 * Proof that the person changing the second factor is the one who signed in,
 * and not someone who sat down at an open browser.
 */
@Injectable()
export class TwoFactorReauthService {
  constructor(private readonly hashService: HashService) {}

  /**
   * @param user - Account being changed, loaded with its password hash
   * @param password - Password from the request, for accounts that have one
   * @param session - Session the request arrived on
   * @throws AppException REAUTH_REQUIRED when no proof was offered
   * @throws AppException INVALID_CURRENT_PASSWORD when the password is wrong
   */
  async assertReauthenticated(
    user: UserDocument,
    password: string | undefined,
    session: SessionAge | undefined,
  ): Promise<void> {
    if (user.password) {
      await this.assertPassword(user.password, password);
      return;
    }

    this.assertFreshSession(session);
  }

  /**
   * The password half on its own, for routes that already ask for a code and
   * need nothing more from a passwordless account.
   */
  async assertPasswordIfSet(
    user: UserDocument,
    password: string | undefined,
  ): Promise<void> {
    if (!user.password) {
      return;
    }

    await this.assertPassword(user.password, password);
  }

  private async assertPassword(
    hash: string,
    password: string | undefined,
  ): Promise<void> {
    if (!password) {
      throw new AppException(
        ErrorCode.REAUTH_REQUIRED,
        'Enter your password to change two-factor authentication',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (!(await this.hashService.compare(password, hash))) {
      throw new AppException(
        ErrorCode.INVALID_CURRENT_PASSWORD,
        'Current password is incorrect',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Passwordless accounts have nothing to re-enter, so a recent sign-in is the
   * proof. Anything older sends them back through the sign-in they use.
   */
  private assertFreshSession(session: SessionAge | undefined): void {
    const startedAt = session ? new Date(session.createdAt).getTime() : 0;

    if (Date.now() - startedAt <= TWO_FACTOR_FRESH_SESSION_MS) {
      return;
    }

    throw new AppException(
      ErrorCode.REAUTH_REQUIRED,
      'Sign in again to change two-factor authentication',
      HttpStatus.UNAUTHORIZED,
    );
  }
}
