import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/enums/error-code.enum';
import { OAuthProviderConfig } from '../../config/oauth.config';
import { OAUTH_STRATEGIES } from './oauth.constants';
import {
  OAuthProviderStrategy,
  OAuthProviderSummary,
} from './oauth-provider.interface';

/**
 * Single lookup point for OAuth providers. Everything provider specific in the
 * application resolves through this registry instead of a hardcoded list.
 */
@Injectable()
export class OAuthRegistryService {
  private readonly logger = new Logger(OAuthRegistryService.name);
  private readonly byId: Map<string, OAuthProviderStrategy>;

  constructor(
    @Inject(OAUTH_STRATEGIES)
    private readonly strategies: OAuthProviderStrategy[],
    private readonly configService: ConfigService,
  ) {
    this.byId = new Map(
      this.strategies.map((strategy) => [strategy.id, strategy]),
    );
    this.logEnabled();
  }

  /** Every registered provider id, enabled or not. */
  getIds(): string[] {
    return [...this.byId.keys()];
  }

  has(providerId: string): boolean {
    return this.byId.has(providerId);
  }

  /**
   * @throws AppException OAUTH_PROVIDER_UNKNOWN when no strategy is registered
   */
  get(providerId: string): OAuthProviderStrategy {
    const strategy = this.byId.get(providerId);
    if (!strategy) {
      throw new AppException(
        ErrorCode.OAUTH_PROVIDER_UNKNOWN,
        `Unknown OAuth provider '${providerId}'`,
        HttpStatus.NOT_FOUND,
        { provider: providerId },
      );
    }
    return strategy;
  }

  /**
   * @throws AppException OAUTH_NOT_CONFIGURED when the provider has no credentials
   */
  getEnabled(providerId: string): OAuthProviderStrategy {
    const strategy = this.get(providerId);
    if (!strategy.isEnabled()) {
      throw new AppException(
        ErrorCode.OAUTH_NOT_CONFIGURED,
        `OAuth provider '${providerId}' is not configured`,
        HttpStatus.SERVICE_UNAVAILABLE,
        { provider: providerId },
      );
    }
    return strategy;
  }

  isEnabled(providerId: string): boolean {
    return this.byId.get(providerId)?.isEnabled() === true;
  }

  listEnabled(): OAuthProviderSummary[] {
    return this.strategies
      .filter((strategy) => strategy.isEnabled())
      .map((strategy) => ({
        id: strategy.id,
        displayName: strategy.displayName,
      }));
  }

  /** Redirect URI registered with the provider for this deployment. */
  getCallbackUrl(providerId: string): string {
    const override = this.configService.get<OAuthProviderConfig>(
      `oauth.providers.${providerId}`,
    )?.callbackUrl;
    if (override) {
      return override;
    }

    const baseUrl = this.configService.get<string>(
      'oauth.callbackBaseUrl',
      '/api/auth/oauth',
    );
    return `${baseUrl.replace(/\/$/, '')}/${providerId}/callback`;
  }

  private logEnabled(): void {
    const enabled = this.listEnabled().map((provider) => provider.id);
    this.logger.log(
      enabled.length > 0
        ? `OAuth providers enabled: ${enabled.join(', ')}`
        : 'No OAuth providers enabled',
    );
  }
}
