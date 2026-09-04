import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Response } from 'express';
import { SignInService, SignInOutcome } from '../services/sign-in.service';
import { User, UserDocument } from '../../user/schemas/user.schema';
import { ProfileSyncService } from '../../user/services/profile-sync.service';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/enums/error-code.enum';
import { isMongoDuplicateKeyError } from '../../common/utils/mongo-error.util';
import {
  OAuthCallbackParams,
  OAuthProfile,
  OAuthProviderStrategy,
} from './oauth-provider.interface';

export interface OAuthLoginParams {
  strategy: OAuthProviderStrategy;
  code: string;
  redirectUri: string;
  codeVerifier?: string;
  nonce?: string;
  /** Raw callback parameters, for providers that ship profile data with them. */
  callbackParams?: OAuthCallbackParams;
  response: Response;
}

const DEFAULT_ROLE = 'user';

/**
 * Turns a provider authorization code into an application session.
 * Provider specifics stay in the strategies; this service only knows ids.
 */
@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly signInService: SignInService,
    private readonly profileSyncService: ProfileSyncService,
  ) {}

  /**
   * @returns whether a second factor is still owed, which the controller turns
   * into a redirect to the challenge page rather than to the client callback
   */
  async login(params: OAuthLoginParams): Promise<SignInOutcome> {
    const { strategy } = params;

    const tokens = await strategy.exchangeCode({
      code: params.code,
      redirectUri: params.redirectUri,
      codeVerifier: params.codeVerifier,
      nonce: params.nonce,
    });

    const profile = await strategy.fetchProfile(tokens, params.callbackParams);
    this.assertEmailVerified(strategy, profile);

    const user = await this.findOrCreateUser(strategy.id, profile);
    await this.profileSyncService.syncProfileFromProvider(
      user._id.toString(),
      strategy.id,
      profile,
    );

    const outcome = await this.signInService.completeSignIn(
      user,
      params.response,
    );

    this.logger.log(
      outcome.requiresTwoFactor
        ? `Second factor owed after ${strategy.id}`
        : `User authenticated through ${strategy.id}`,
    );
    return outcome;
  }

  /**
   * Resolves the account for a provider profile: existing link, existing email,
   * or a new user. The account email is never overwritten from the provider.
   */
  async findOrCreateUser(
    provider: string,
    profile: OAuthProfile,
  ): Promise<UserDocument> {
    const linked = await this.userModel.findOne({
      linkedAccounts: {
        $elemMatch: { provider, providerId: profile.providerId },
      },
    });

    if (linked) {
      this.assertActive(linked, provider);
      return linked;
    }

    const byEmail = await this.userModel.findOne({ email: profile.email });
    if (byEmail) {
      this.assertActive(byEmail, provider);
      return this.linkToExistingUser(byEmail, provider, profile);
    }

    return this.createUser(provider, profile);
  }

  private async linkToExistingUser(
    user: UserDocument,
    provider: string,
    profile: OAuthProfile,
  ): Promise<UserDocument> {
    user.linkedAccounts.push({
      provider,
      providerId: profile.providerId,
      linkedAt: new Date(),
    });
    user.isVerified = true;
    if (!user.primaryProvider) {
      user.primaryProvider = provider;
    }

    try {
      await user.save();
    } catch (error) {
      throw this.toLinkConflict(error, provider);
    }

    this.logger.log(`Linked ${provider} account to an existing user`);
    return user;
  }

  private async createUser(
    provider: string,
    profile: OAuthProfile,
  ): Promise<UserDocument> {
    try {
      const user = await this.userModel.create({
        email: profile.email,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
        isVerified: true,
        authProvider: provider,
        primaryProvider: provider,
        linkedAccounts: [
          {
            provider,
            providerId: profile.providerId,
            linkedAt: new Date(),
          },
        ],
        role: DEFAULT_ROLE,
      });

      this.logger.log(`Created a new user through ${provider}`);
      return user;
    } catch (error) {
      throw this.toLinkConflict(error, provider);
    }
  }

  private assertEmailVerified(
    strategy: OAuthProviderStrategy,
    profile: OAuthProfile,
  ): void {
    if (profile.emailVerified || strategy.emailAlwaysVerified) {
      return;
    }

    throw new AppException(
      ErrorCode.OAUTH_EMAIL_UNVERIFIED,
      `The email address on this ${strategy.displayName} account is not verified`,
      HttpStatus.FORBIDDEN,
      { provider: strategy.id },
    );
  }

  private assertActive(user: UserDocument, provider: string): void {
    if (!user.isDeleted) {
      return;
    }

    this.logger.warn(
      `OAuth login rejected for a deleted account (${provider})`,
    );
    throw new AppException(
      ErrorCode.OAUTH_AUTHENTICATION_FAILED,
      'OAuth authentication failed',
      HttpStatus.UNAUTHORIZED,
      { provider },
    );
  }

  private toLinkConflict(error: unknown, provider: string): unknown {
    if (!isMongoDuplicateKeyError(error)) {
      return error;
    }

    return new AppException(
      ErrorCode.OAUTH_ACCOUNT_LINKED_ELSEWHERE,
      'This provider account is already linked to another user',
      HttpStatus.CONFLICT,
      { provider },
    );
  }
}
