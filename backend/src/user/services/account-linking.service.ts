import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { EMAIL_PROVIDER } from '../../common/constants/oauth-providers';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/enums/error-code.enum';
import { UniqueConflictError } from '../../common/persistence/persistence-errors';
import { OAuthProfile } from '../../auth/oauth/oauth-provider.interface';
import { LinkedAccountStore } from '../stores/linked-account.store';
import { StoredAccount } from '../stores/stored-account';

/**
 * Links and unlinks OAuth accounts on a user.
 *
 * Provider ids come from the OAuth registry; this service only hands them to
 * the store as links and reads `linkedProviders` back.
 */
@Injectable()
export class AccountLinkingService {
  private readonly logger = new Logger(AccountLinkingService.name);

  constructor(private readonly links: LinkedAccountStore) {}

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
  ): Promise<StoredAccount> {
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

    let linked: StoredAccount;
    try {
      linked = await this.links.addLink(user, {
        provider,
        providerId: profile.providerId,
        ...(user.primaryProvider ? {} : { primaryProvider: provider }),
      });
    } catch (error) {
      if (error instanceof UniqueConflictError) {
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
    return linked;
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
  ): Promise<StoredAccount> {
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

    const remaining = user.linkedAccounts.filter(
      (account) => account.provider !== provider,
    );
    const unlinked = await this.links.removeLink(user, {
      provider,
      primaryProvider:
        user.primaryProvider === provider
          ? remaining[0]?.provider
          : user.primaryProvider,
    });

    this.logger.log(`User ${userId} unlinked their ${provider} account`);
    return unlinked;
  }

  /** Every sign-in method on the account, including 'email'. */
  async getLinkedProviders(userId: string): Promise<string[]> {
    const user = await this.links.findLinks(userId);
    return this.active(user).linkedProviders;
  }

  async canUnlinkProvider(userId: string, provider: string): Promise<boolean> {
    const user = await this.links.findLinkedProviders(userId);

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
    const user = await this.links.findPrimaryProviderState(userId);

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
  ): Promise<StoredAccount> {
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

    const saved = await this.links.savePrimaryProvider(user, provider);

    this.logger.log(`User ${userId} set ${provider} as primary provider`);
    return saved;
  }

  private async requireUser(userId: string): Promise<StoredAccount> {
    return this.active(await this.links.findAccount(userId));
  }

  private active(user: StoredAccount | null): StoredAccount {
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
