import {
  Injectable,
  Logger, // feature:totp
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Response } from 'express';
import { UserDocument } from '../../user/schemas/user.schema';
import { Role, RoleDocument } from '../../role/schemas/role.schema';
import { SessionService } from './session.service';
import { SessionCookieService } from './session-cookie.service';
import { AuthFeaturesService } from './auth-features.service'; // feature:totp
import { AuthFeature } from '../enums/auth-feature.enum'; // feature:totp
import {
  AuthenticatedUserSummary,
  toAuthenticatedUser,
} from '../utils/authenticated-user.util';
import { TwoFactorChallengeService } from '../two-factor/services/two-factor-challenge.service'; // feature:totp

/**
 * Either the sign-in finished and the caller has a session, or a second factor
 * is owed and the challenge cookie is already set.
 */
export type SignInOutcome =
  | { requiresTwoFactor: true }
  | { requiresTwoFactor: false; user: AuthenticatedUserSummary };

/**
 * The last step of every sign-in, shared by password, magic link and OAuth.
 * Keeping it in one place is what stops a new sign-in route from quietly
 * skipping the second factor.
 */
@Injectable()
export class SignInService {
  private readonly logger = new Logger(SignInService.name); // feature:totp

  constructor(
    @InjectModel(Role.name) private readonly roleModel: Model<RoleDocument>,
    private readonly sessionService: SessionService,
    private readonly sessionCookieService: SessionCookieService,
    private readonly authFeaturesService: AuthFeaturesService, // feature:totp
    private readonly challengeService: TwoFactorChallengeService, // feature:totp
  ) {}

  /**
   * Finishes a sign-in for a user who cleared their first factor. An account
   * with a confirmed second factor gets a challenge cookie instead of a
   * session.
   */
  async completeSignIn(
    user: UserDocument,
    response: Response,
  ): Promise<SignInOutcome> {
    // feature:totp:start
    if (this.owesSecondFactor(user)) {
      await this.challengeService.issue(user._id, response);
      this.logger.log('Sign-in held for a second factor');
      return { requiresTwoFactor: true };
    }
    // feature:totp:end

    return {
      requiresTwoFactor: false,
      user: await this.issueSession(user, response),
    };
  }

  /**
   * Creates the session and sets its cookie, with no second factor check. Only
   * for callers that already collected one.
   */
  async issueSession(
    user: UserDocument,
    response: Response,
  ): Promise<AuthenticatedUserSummary> {
    const userAgent = response.req.headers['user-agent'] || 'Unknown';
    const ip = response.req.ip || '127.0.0.1';
    const sessionToken = await this.sessionService.createSession(
      user._id,
      userAgent,
      ip,
    );

    this.sessionCookieService.set(response, sessionToken);
    return toAuthenticatedUser(user, this.roleModel);
  }

  // feature:totp:start
  /**
   * A deployment that turned two-factor off signs everyone in directly. The
   * verify route is closed there, so a challenge would strand the account.
   */
  private owesSecondFactor(user: UserDocument): boolean {
    return (
      user.twoFactor?.enabled === true &&
      this.authFeaturesService.isEnabled(AuthFeature.TWO_FACTOR)
    );
  }
  // feature:totp:end
}
