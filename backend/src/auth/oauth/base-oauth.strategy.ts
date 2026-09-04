import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/enums/error-code.enum';
import { OAuthProviderConfig } from '../../config/oauth.config';
import {
  AuthorizationUrlParams,
  ExchangeCodeParams,
  OAuthCallbackMethod,
  OAuthCallbackParams,
  OAuthProfile,
  OAuthProviderStrategy,
  OAuthTokens,
} from './oauth-provider.interface';

export interface OAuthCredentials {
  clientId: string;
  clientSecret: string;
}

/**
 * Shared configuration lookup and HTTP helpers for provider strategies.
 * Provider specific endpoints and payload shapes live in the subclasses.
 */
@Injectable()
export abstract class BaseOAuthStrategy implements OAuthProviderStrategy {
  abstract readonly id: string;
  abstract readonly displayName: string;
  abstract readonly supportsPkce: boolean;
  abstract readonly usesOidc: boolean;
  abstract readonly emailAlwaysVerified: boolean;

  /** Providers that post their callback override this with 'POST'. */
  readonly callbackMethod: OAuthCallbackMethod = 'GET';

  protected readonly logger = new Logger(this.constructor.name);

  constructor(protected readonly configService: ConfigService) {}

  get envPrefix(): string {
    return `OAUTH_${this.id.toUpperCase()}`;
  }

  isEnabled(): boolean {
    return this.providerConfig?.enabled === true;
  }

  abstract getAuthorizationUrl(params: AuthorizationUrlParams): string;

  abstract exchangeCode(params: ExchangeCodeParams): Promise<OAuthTokens>;

  abstract fetchProfile(
    tokens: OAuthTokens,
    callbackParams?: OAuthCallbackParams,
  ): Promise<OAuthProfile>;

  protected get providerConfig(): OAuthProviderConfig | undefined {
    return this.configService.get<OAuthProviderConfig>(
      `oauth.providers.${this.id}`,
    );
  }

  /**
   * Client credentials for this provider.
   *
   * @throws AppException when the provider has no credentials configured
   */
  protected credentials(): OAuthCredentials {
    const config = this.providerConfig;
    if (!config?.clientId || !config.clientSecret) {
      throw new AppException(
        ErrorCode.OAUTH_NOT_CONFIGURED,
        `OAuth provider '${this.id}' is not configured`,
        HttpStatus.SERVICE_UNAVAILABLE,
        { provider: this.id },
      );
    }
    return { clientId: config.clientId, clientSecret: config.clientSecret };
  }

  protected codeExchangeFailed(reason: string): AppException {
    this.logger.warn(`Code exchange failed for ${this.id}: ${reason}`);
    return new AppException(
      ErrorCode.OAUTH_CODE_INVALID,
      'Authorization code could not be exchanged',
      HttpStatus.BAD_REQUEST,
      { provider: this.id },
    );
  }

  protected profileFetchFailed(reason: string): AppException {
    this.logger.warn(`Profile fetch failed for ${this.id}: ${reason}`);
    return new AppException(
      ErrorCode.OAUTH_AUTHENTICATION_FAILED,
      'Provider profile could not be read',
      HttpStatus.BAD_GATEWAY,
      { provider: this.id },
    );
  }

  protected async httpGetJson<T>(
    url: string,
    headers: Record<string, string> = {},
  ): Promise<T> {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json', ...headers },
    });

    if (!response.ok) {
      throw this.profileFetchFailed(
        `${response.status} ${response.statusText}`,
      );
    }

    return (await response.json()) as T;
  }

  /**
   * POST an application/x-www-form-urlencoded body. Credentials always travel
   * in the body, never in the query string.
   */
  protected async httpPostForm<T>(
    url: string,
    body: Record<string, string>,
    headers: Record<string, string> = {},
  ): Promise<T> {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        ...headers,
      },
      body: new URLSearchParams(body).toString(),
    });

    if (!response.ok) {
      throw this.codeExchangeFailed(
        `${response.status} ${response.statusText}`,
      );
    }

    return (await response.json()) as T;
  }
}
