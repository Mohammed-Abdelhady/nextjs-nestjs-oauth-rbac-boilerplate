import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { EMAIL_PROVIDER } from '../../common/constants/oauth-providers';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/enums/error-code.enum';
import { UniqueConflictError } from '../../common/persistence/persistence-errors';
import { runLeavingFailuresAsRaised } from '../../common/persistence/store-failure';
import {
  UnitOfWork,
  UnitOfWorkRunner,
} from '../../common/persistence/unit-of-work';
import { OAuthProfile } from '../../auth/oauth/oauth-provider.interface';
import { UNLINK_HINT, UnlinkHint } from '../dto/account-linking.dto';
import { LinkedAccountStore } from '../stores/linked-account.store';
import { StoredAccount } from '../stores/stored-account';
import {
  SignInMethodRule,
  WAY_IN_OUTCOME,
  WayInOutcome,
  WaysLeft,
} from './sign-in-method.rule';

/**
 * What an unlink accepts as left: every other linked provider, and email
 * sign-in on an account created for it while the deployment can sign that
 * address in or recover it, by password reset or by magic link.
 */
function waysLeftWithout(provider: string): WaysLeft {
  return (held, switches) => {
    const email = held.emailSignIn && (switches.password || switches.magicLink);
    const others = held.linkedProviders.filter((linked) => linked !== provider);

    return (email ? 1 : 0) + others.length;
  };
}

const NOT_LINKED = 'not_linked';

/**
 * The one answer to "may this provider be unlinked", for the unlink and for
 * the hint a page reads. Email is never a link, a provider has to be linked,
 * and the last way in stays.
 */
function unlinkAnswer(
  provider: string,
  linkedProviders: string[],
  wayIn: WayInOutcome,
): UnlinkHint | typeof NOT_LINKED {
  if (provider === EMAIL_PROVIDER) {
    return UNLINK_HINT.NOT_REMOVABLE;
  }
  if (!linkedProviders.includes(provider)) {
    return NOT_LINKED;
  }
  return wayIn === WAY_IN_OUTCOME.ANOTHER_LEFT
    ? UNLINK_HINT.ALLOWED
    : UNLINK_HINT.LAST_SIGN_IN_METHOD;
}

/** How an unlink refuses each answer but the allowed one. */
const UNLINK_REFUSAL: Record<
  Exclude<ReturnType<typeof unlinkAnswer>, typeof UNLINK_HINT.ALLOWED>,
  { code: ErrorCode; message: (provider: string) => string }
> = {
  [UNLINK_HINT.NOT_REMOVABLE]: {
    code: ErrorCode.VALIDATION_ERROR,
    message: () => 'Email sign-in cannot be unlinked',
  },
  [NOT_LINKED]: {
    code: ErrorCode.PROVIDER_NOT_LINKED,
    message: (provider) => `${provider} is not linked to your account`,
  },
  [UNLINK_HINT.LAST_SIGN_IN_METHOD]: {
    code: ErrorCode.CANNOT_UNLINK_LAST_PROVIDER,
    message: () => 'You must keep at least one sign-in method',
  },
};

/**
 * Links and unlinks OAuth accounts on a user.
 *
 * Provider ids come from the OAuth registry; this service only hands them to
 * the store as links and reads `linkedProviders` back.
 */
@Injectable()
export class AccountLinkingService {
  private readonly logger = new Logger(AccountLinkingService.name);

  constructor(
    private readonly links: LinkedAccountStore,
    private readonly signInMethods: SignInMethodRule,
    private readonly runner: UnitOfWorkRunner,
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
    // The count and the removal commit or abort together, so two removals of
    // a way in at once cannot each count the other's as the one that stays.
    const unlinked = await runLeavingFailuresAsRaised(
      this.runner,
      (unitOfWork) => this.unlinkHeld(unitOfWork, userId, provider),
    );

    this.logger.log(`User ${userId} unlinked their ${provider} account`);
    return unlinked;
  }

  private async unlinkHeld(
    unitOfWork: UnitOfWork,
    userId: string,
    provider: string,
  ): Promise<StoredAccount> {
    // Held first: the account read below is then the one the removal changes.
    const wayIn = await this.signInMethods.holdForRemoval(
      unitOfWork,
      userId,
      waysLeftWithout(provider),
    );
    const user = this.active(await this.links.readAccount(unitOfWork, userId));

    const answer = unlinkAnswer(provider, user.linkedProviders, wayIn);
    if (answer !== UNLINK_HINT.ALLOWED) {
      const refusal = UNLINK_REFUSAL[answer];
      throw new AppException(
        refusal.code,
        refusal.message(provider),
        HttpStatus.BAD_REQUEST,
        { provider },
      );
    }

    const remaining = user.linkedAccounts.filter(
      (account) => account.provider !== provider,
    );
    return this.links.removeLink(unitOfWork, user, {
      provider,
      primaryProvider:
        user.primaryProvider === provider
          ? remaining[0]?.provider
          : user.primaryProvider,
    });
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

    const hints = await this.unlinkHints(userId, user.linkedProviders);
    return hints[provider] === UNLINK_HINT.ALLOWED;
  }

  /**
   * What an unlink of each of the account's sign-in methods would be told
   * now, from the rule the unlink asks. Nothing is held, so a page may offer
   * an unlink that is refused a moment later.
   */
  async unlinkHints(
    userId: string,
    linkedProviders: string[],
  ): Promise<Record<string, UnlinkHint>> {
    const advise = await this.signInMethods.adviseOnRemoval(userId);
    const hints: Record<string, UnlinkHint> = {};
    for (const provider of linkedProviders) {
      const answer = unlinkAnswer(
        provider,
        linkedProviders,
        advise(waysLeftWithout(provider)),
      );
      if (answer !== NOT_LINKED) {
        hints[provider] = answer;
      }
    }
    return hints;
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
