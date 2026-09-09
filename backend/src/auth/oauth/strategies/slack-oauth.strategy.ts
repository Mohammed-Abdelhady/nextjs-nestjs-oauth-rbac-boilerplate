import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseOAuthStrategy } from '../base-oauth.strategy';
import {
  AuthorizationUrlParams,
  ExchangeCodeParams,
  OAuthProfile,
  OAuthTokens,
} from '../oauth-provider.interface';
import { IdTokenClaims, verifyIdToken } from '../utils/id-token.util';

const AUTH_URL = 'https://slack.com/openid/connect/authorize';
const TOKEN_URL = 'https://slack.com/api/openid.connect.token';
const USERINFO_URL = 'https://slack.com/api/openid.connect.userInfo';
const JWKS_URI = 'https://slack.com/openid/connect/keys';
const ISSUERS = ['https://slack.com'];
const SCOPES = ['openid', 'profile', 'email'];

/** Slack answers 200 with `ok: false` instead of an HTTP error status. */
interface SlackApiResponse {
  ok?: boolean;
  error?: string;
}

interface SlackTokenResponse extends SlackApiResponse {
  access_token?: string;
  token_type?: string;
  id_token?: string;
}

interface SlackUserInfo extends SlackApiResponse {
  sub?: string;
  name?: string;
  email?: string;
  email_verified?: boolean;
  picture?: string;
}

/**
 * Slack OpenID Connect.
 *
 * A Slack identity is a user inside one workspace, and `sub` already carries
 * both parts, so it stands alone as the provider id. The same person in two
 * workspaces is two accounts here, which is what Slack means by it.
 *
 * Slack takes no code challenge and its authorize endpoint only supports
 * `response_mode=query`, so the nonce is what binds the id_token to this
 * request; it is required rather than optional.
 */
@Injectable()
export class SlackOAuthStrategy extends BaseOAuthStrategy {
  readonly id = 'slack';
  readonly displayName = 'Slack';
  readonly supportsPkce = false;
  readonly usesOidc = true;
  readonly emailAlwaysVerified = false;

  constructor(configService: ConfigService) {
    super(configService);
  }

  getAuthorizationUrl(params: AuthorizationUrlParams): string {
    const { clientId } = this.credentials();
    const query = new URLSearchParams({
      client_id: clientId,
      redirect_uri: params.redirectUri,
      response_type: 'code',
      response_mode: 'query',
      scope: SCOPES.join(' '),
      state: params.state,
    });

    if (params.nonce) {
      query.set('nonce', params.nonce);
    }

    return `${AUTH_URL}?${query.toString()}`;
  }

  async exchangeCode(params: ExchangeCodeParams): Promise<OAuthTokens> {
    if (!params.nonce) {
      throw this.codeExchangeFailed('the flow started without a nonce');
    }

    const { clientId, clientSecret } = this.credentials();
    const response = await this.httpPostForm<SlackTokenResponse>(TOKEN_URL, {
      client_id: clientId,
      client_secret: clientSecret,
      code: params.code,
      redirect_uri: params.redirectUri,
      grant_type: 'authorization_code',
    });

    if (response.ok === false || !response.access_token) {
      throw this.codeExchangeFailed(response.error ?? 'no access token');
    }
    if (!response.id_token) {
      throw this.codeExchangeFailed('token response carried no id_token');
    }

    await this.verifyClaims(response.id_token, params.nonce);

    return {
      accessToken: response.access_token,
      idToken: response.id_token,
      tokenType: response.token_type,
    };
  }

  async fetchProfile(tokens: OAuthTokens): Promise<OAuthProfile> {
    if (!tokens.idToken) {
      throw this.profileFetchFailed('no id_token to read claims from');
    }

    const claims = await this.verifyClaims(tokens.idToken);
    const userInfo = await this.httpGetJson<SlackUserInfo>(USERINFO_URL, {
      Authorization: `Bearer ${tokens.accessToken}`,
    });

    if (userInfo.ok === false) {
      throw this.profileFetchFailed(userInfo.error ?? 'userinfo refused');
    }

    const email = userInfo.email ?? claims.email;
    if (!email) {
      throw this.profileFetchFailed('userinfo returned no email');
    }

    return {
      providerId: claims.sub,
      email,
      // Slack states the verification flag on the id_token, not on userinfo.
      emailVerified:
        claims.email_verified === true || claims.email_verified === 'true',
      name: userInfo.name ?? claims.name ?? email,
      avatarUrl: userInfo.picture,
    };
  }

  private async verifyClaims(
    idToken: string,
    nonce?: string,
  ): Promise<IdTokenClaims> {
    const { clientId } = this.credentials();

    try {
      return await verifyIdToken({
        idToken,
        jwksUri: JWKS_URI,
        issuers: ISSUERS,
        audience: clientId,
        nonce,
      });
    } catch (error) {
      throw this.profileFetchFailed(
        `id_token rejected: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
