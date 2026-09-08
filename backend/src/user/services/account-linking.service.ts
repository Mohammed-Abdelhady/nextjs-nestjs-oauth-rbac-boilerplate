import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../schemas/user.schema';
import { EMAIL_PROVIDER } from '../../common/constants/oauth-providers';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/enums/error-code.enum';
import { isMongoDuplicateKeyError } from '../../common/utils/mongo-error.util';
import { OAuthProfile } from '../../auth/oauth/oauth-provider.interface';

const LINKED_ACCOUNT_FIELDS = 'linkedAccounts authProvider primaryProvider';

/**
 * Links and unlinks OAuth accounts on a user.
 *
 * Provider ids come from the OAuth registry; this service only stores them as
 * entries of `linkedAccounts` and derives `linkedProviders` from that array.
 */
@Injectable()
export class AccountLinkingService {
  private readonly logger = new Logger(AccountLinkingService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  /**
   * Adds a provider account to a user.
   *
   * @throws AppException when the provider is linked already, belongs to
   * another user, or reports a different email address
   */
  async linkProvider(
    userId: string,
    provider: string,
    profile: OAuthProfile,
  ): Promise<UserDocument> {
    const user = await this.requireUser(userId);

    if (user.linkedProviders.includes(provider)) {
      throw new AppException(
        ErrorCode.PROVIDER_ALREADY_LINKED,
        `${provider} is already linked to your account`,
        HttpStatus.CONFLICT,
        { provider },
      );
    }

    if (profile.email && profile.email !== user.email) {
      this.logger.warn(`Email mismatch while linking ${provider}`);
      throw new AppException(
        ErrorCode.EMAIL_MISMATCH_ON_LINK,
        `The email on this ${provider} account does not match your account email`,
        HttpStatus.CONFLICT,
        { provider },
      );
    }

    user.linkedAccounts.push({
      provider,
      providerId: profile.providerId,
      linkedAt: new Date(),
    });

    if (!user.primaryProvider) {
      user.primaryProvider = provider;
    }

    try {
      await user.save();
    } catch (error) {
      if (isMongoDuplicateKeyError(error)) {
        throw new AppException(
          ErrorCode.OAUTH_ACCOUNT_LINKED_ELSEWHERE,
          `This ${provider} account is already linked to another user`,
          HttpStatus.CONFLICT,
          { provider },
        );
      }
      throw error;
    }

    this.logger.log(`User ${userId} linked a ${provider} account`);
    return user;
  }

  /**
   * Removes a provider account from a user.
   *
   * @throws AppException when the provider is not linked or it is the only
   * remaining sign-in method
   */
  async unlinkProvider(
    userId: string,
    provider: string,
  ): Promise<UserDocument> {
    const user = await this.requireUser(userId);

    if (provider === EMAIL_PROVIDER) {
      throw new AppException(
        ErrorCode.VALIDATION_ERROR,
        'Email sign-in cannot be unlinked',
        HttpStatus.BAD_REQUEST,
        { provider },
      );
    }

    if (!user.linkedProviders.includes(provider)) {
      throw new AppException(
        ErrorCode.PROVIDER_NOT_LINKED,
        `${provider} is not linked to your account`,
        HttpStatus.BAD_REQUEST,
        { provider },
      );
    }

    if (user.linkedProviders.length === 1) {
      throw new AppException(
        ErrorCode.CANNOT_UNLINK_LAST_PROVIDER,
        'You must keep at least one sign-in method',
        HttpStatus.BAD_REQUEST,
        { provider },
      );
    }

    user.linkedAccounts = user.linkedAccounts.filter(
      (account) => account.provider !== provider,
    );

    if (user.primaryProvider === provider) {
      user.primaryProvider = user.linkedAccounts[0]?.provider;
    }

    await user.save();

    this.logger.log(`User ${userId} unlinked their ${provider} account`);
    return user;
  }

  /** Every sign-in method on the account, including 'email'. */
  async getLinkedProviders(userId: string): Promise<string[]> {
    const user = await this.requireUser(userId, LINKED_ACCOUNT_FIELDS);
    return user.linkedProviders;
  }

  async canUnlinkProvider(userId: string, provider: string): Promise<boolean> {
    const user = await this.userModel
      .findById(userId)
      .select(LINKED_ACCOUNT_FIELDS)
      .exec();

    if (!user || user.isDeleted) {
      return false;
    }

    return (
      provider !== EMAIL_PROVIDER &&
      user.linkedProviders.includes(provider) &&
      user.linkedProviders.length > 1
    );
  }

  async isPrimaryProvider(userId: string, provider: string): Promise<boolean> {
    const user = await this.userModel
      .findById(userId)
      .select('primaryProvider isDeleted')
      .exec();

    if (!user || user.isDeleted) {
      return false;
    }

    return user.primaryProvider === provider;
  }

  /**
   * Chooses which provider profile sync follows.
   *
   * @throws AppException when the provider is not linked or is email sign-in
   */
  async setPrimaryProvider(
    userId: string,
    provider: string,
  ): Promise<UserDocument> {
    const user = await this.requireUser(userId);

    if (provider === EMAIL_PROVIDER) {
      throw new AppException(
        ErrorCode.VALIDATION_ERROR,
        'Email sign-in has no profile to sync',
        HttpStatus.BAD_REQUEST,
        { provider },
      );
    }

    if (!user.linkedProviders.includes(provider)) {
      throw new AppException(
        ErrorCode.PROVIDER_NOT_LINKED,
        `${provider} is not linked to your account`,
        HttpStatus.BAD_REQUEST,
        { provider },
      );
    }

    user.primaryProvider = provider;
    await user.save();

    this.logger.log(`User ${userId} set ${provider} as primary provider`);
    return user;
  }

  private async requireUser(
    userId: string,
    fields?: string,
  ): Promise<UserDocument> {
    const query = this.userModel.findById(userId);
    if (fields) {
      query.select(`${fields} isDeleted`);
    }
    const user = await query.exec();

    if (!user || user.isDeleted) {
      throw new AppException(
        ErrorCode.USER_NOT_FOUND,
        'User not found',
        HttpStatus.NOT_FOUND,
      );
    }

    return user;
  }
}
