import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/enums/error-code.enum';
import {
  OAUTH_CLIENT_CALLBACK_PATH,
  OAUTH_DEFAULT_REDIRECT,
} from './oauth.constants';
import { TWO_FACTOR_CLIENT_PATH } from '../two-factor/constants/two-factor.constants';

/**
 * Builds the 302 responses that hand control back to the client application.
 */
@Injectable()
export class OAuthRedirectService {
  private readonly logger = new Logger(OAuthRedirectService.name);

  constructor(private readonly configService: ConfigService) {}

  toClientSuccess(response: Response, redirect: string): void {
    const url = this.clientCallbackUrl();
    url.searchParams.set('status', 'ok');
    url.searchParams.set('redirect', redirect || OAUTH_DEFAULT_REDIRECT);
    response.redirect(HttpStatus.FOUND, url.toString());
  }

  /**
   * The provider signed the user in but the account owes a code. The challenge
   * cookie is already set, so the client only has to collect the code.
   */
  toTwoFactorChallenge(response: Response, redirect: string): void {
    const clientUrl = this.configService.get<string>(
      'cors.clientUrl',
      'http://localhost:3000',
    );
    const url = new URL(
      `${clientUrl.replace(/\/$/, '')}${TWO_FACTOR_CLIENT_PATH}`,
    );
    url.searchParams.set('redirect', redirect || OAUTH_DEFAULT_REDIRECT);
    response.redirect(HttpStatus.FOUND, url.toString());
  }

  toClientError(
    response: Response,
    error: unknown,
    provider: string,
    redirect?: string,
  ): void {
    const code =
      error instanceof AppException
        ? error.getCode()
        : ErrorCode.OAUTH_AUTHENTICATION_FAILED;

    this.logger.warn(
      `OAuth flow failed for ${provider}: ${code} - ${
        error instanceof Error ? error.message : String(error)
      }`,
    );

    const url = this.clientCallbackUrl();
    url.searchParams.set('status', 'error');
    url.searchParams.set('code', code);
    url.searchParams.set('provider', provider);
    if (redirect) {
      url.searchParams.set('redirect', redirect);
    }
    response.redirect(HttpStatus.FOUND, url.toString());
  }

  private clientCallbackUrl(): URL {
    const clientUrl = this.configService.get<string>(
      'cors.clientUrl',
      'http://localhost:3000',
    );
    return new URL(
      `${clientUrl.replace(/\/$/, '')}${OAUTH_CLIENT_CALLBACK_PATH}`,
    );
  }
}
