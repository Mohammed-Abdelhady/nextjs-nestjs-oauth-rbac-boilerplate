import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBody,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiHeader,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { Public } from '../../auth/decorators/public.decorator';
import { SkipBrowserProof } from '../../auth/decorators/skip-browser-proof.decorator';
import { RequestWithUser } from '../../auth/guards/auth.guard';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/enums/error-code.enum';
import { CSRF_HEADER } from '../constants/browser-proof';
import {
  NATIVE_AUTHORIZE_CLIENT_PATH,
  NATIVE_TRANSACTION_QUERY_KEY,
} from '../../common/constants/client-paths';
import { SESSION_SWAGGER_AUTH_NAME } from '../../common/constants/session';
import { CREDENTIAL_PURPOSE } from '../constants/credential-purpose';
import {
  NATIVE_DPOP_NONCE_HEADER,
  NATIVE_DPOP_PROOF_HEADER,
} from '../constants/session-policy';
import { AuthEpochService } from '../../common/services/auth-epoch.service';
import { NativeAuthorizeBrowserService } from './native-authorize-browser.service';
import { NativeAuthorizeService } from './native-authorize.service';
import { NativeTokenService } from './native-token.service';
import { NativeAuthorizeActionDto } from './dto/native-authorize.dto';
import {
  ApiNativeTokenExchange,
  ApiNativeAuthorizeApproveErrors,
  ApiNativeAuthorizeStart,
  ApiNativeRevoke,
} from './native-oauth.swagger';
import { negotiateNativeAuthorizeLocale } from './native-locale.util';
import {
  OauthFailure,
  RevokeRequest,
  TokenRequest,
  TokenSuccess,
} from './native-oauth.types';
import {
  readSessionCookie,
  requestIp,
  requestUserAgent,
} from './native-request';

@ApiTags('oauth')
@Controller('oauth')
export class NativeOAuthController {
  constructor(
    private readonly authorize: NativeAuthorizeService,
    private readonly authorizeBrowser: NativeAuthorizeBrowserService,
    private readonly tokens: NativeTokenService,
    private readonly config: ConfigService,
    private readonly authEpoch: AuthEpochService,
  ) {}

  @Public()
  @SkipBrowserProof()
  @ApiNativeAuthorizeStart()
  @Get('authorize')
  async authorizeGet(
    @Query() query: unknown,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const result = await this.authorize.begin(query);
    if (!result.ok) {
      this.writeError(response, result);
      return;
    }
    const locale = negotiateNativeAuthorizeLocale(
      request.headers['accept-language'],
    );
    const target = new URL(
      `/${locale}${NATIVE_AUTHORIZE_CLIENT_PATH}`,
      this.authEpoch.clientUrl(),
    );
    target.searchParams.set(NATIVE_TRANSACTION_QUERY_KEY, result.transactionId);
    response.setHeader('Cache-Control', 'no-store');
    response.redirect(target.toString());
  }

  @ApiCookieAuth(SESSION_SWAGGER_AUTH_NAME)
  @ApiOperation({
    summary: 'Read a native authorization request',
    description:
      'Returns the application name, platform, expiry, and current grant state. ' +
      'It never returns the callback URI, state, or PKCE challenge.',
  })
  @ApiParam({ name: 'id', description: 'Native authorization transaction id' })
  @ApiOkResponse({
    schema: {
      example: {
        success: true,
        data: {
          applicationName: 'Example Mobile App',
          platform: 'native',
          expiresAt: '2026-10-01T12:05:00.000Z',
          alreadyGranted: false,
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'A browser session is required' })
  @ApiForbiddenResponse({ description: 'Native sign-in is disabled' })
  @ApiNotFoundResponse({
    description: 'The transaction is unknown, expired, ended, or disabled',
  })
  @Get('authorize/transaction/:id')
  async transaction(
    @Param('id') transactionId: string,
    @Req() request: RequestWithUser,
    @Res() response: Response,
  ): Promise<void> {
    const userId = this.requireBrowserSession(request);
    const data = await this.authorizeBrowser.getTransaction(
      userId,
      transactionId,
    );
    response.setHeader('Cache-Control', 'no-store');
    response.status(HttpStatus.OK).json({ success: true, data });
  }

  @ApiCookieAuth(SESSION_SWAGGER_AUTH_NAME)
  @ApiOperation({
    summary: 'Approve a native authorization request',
    description:
      'Atomically approves one pending request and returns its callback URI.',
  })
  @ApiBody({ type: NativeAuthorizeActionDto })
  @ApiHeader({
    name: CSRF_HEADER,
    required: true,
    description: 'Single-use browser proof',
  })
  @ApiOkResponse({
    schema: {
      example: {
        success: true,
        data: { redirectUri: 'myapp://callback?code=abc&state=xyz' },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'A browser session is required' })
  @ApiNativeAuthorizeApproveErrors()
  @Post('authorize/approve')
  async approve(
    @Body() body: NativeAuthorizeActionDto,
    @Req() request: RequestWithUser,
    @Res() response: Response,
  ): Promise<void> {
    const userId = this.requireBrowserSession(request);
    const transactionId = body.transactionId.trim();
    if (!transactionId) {
      throw new AppException(
        ErrorCode.VALIDATION_ERROR,
        'Authorization approval is incomplete',
        HttpStatus.BAD_REQUEST,
      );
    }
    const approved = await this.authorize.approve(
      userId,
      transactionId,
      request.session?.authenticationMethods ?? [],
    );
    response.setHeader('Cache-Control', 'no-store');
    response.status(HttpStatus.OK).json({ success: true, data: approved });
  }

  @ApiCookieAuth(SESSION_SWAGGER_AUTH_NAME)
  @ApiOperation({
    summary: 'Deny a native authorization request',
    description:
      'Atomically denies one pending request and returns its callback URI.',
  })
  @ApiBody({ type: NativeAuthorizeActionDto })
  @ApiHeader({
    name: CSRF_HEADER,
    required: true,
    description: 'Single-use browser proof',
  })
  @ApiOkResponse({
    schema: {
      example: {
        success: true,
        data: {
          redirectUri: 'myapp://callback?error=access_denied&state=xyz',
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'A browser session is required' })
  @ApiForbiddenResponse({
    description: 'Browser proof is invalid or native sign-in is disabled',
  })
  @ApiNotFoundResponse({ description: 'The transaction is expired or ended' })
  @Post('authorize/deny')
  async deny(
    @Body() body: NativeAuthorizeActionDto,
    @Req() request: RequestWithUser,
    @Res() response: Response,
  ): Promise<void> {
    this.requireBrowserSession(request);
    const denied = await this.authorizeBrowser.deny(body.transactionId);
    response.setHeader('Cache-Control', 'no-store');
    response.status(HttpStatus.OK).json({ success: true, data: denied });
  }

  @Public()
  @SkipBrowserProof()
  @ApiNativeTokenExchange()
  @Post('token')
  async token(
    @Body() body: TokenRequest,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    if (this.hasSessionCookie(request)) {
      this.writeError(response, {
        ok: false,
        status: HttpStatus.BAD_REQUEST,
        error: 'invalid_request',
      });
      return;
    }
    const result = await this.tokens.grant(
      body,
      {
        ip: requestIp(request),
        userAgent: requestUserAgent(request),
      },
      request.get(NATIVE_DPOP_PROOF_HEADER),
    );
    this.writeToken(response, result);
  }

  @Public()
  @SkipBrowserProof()
  @ApiNativeRevoke()
  @Post('revoke')
  async revoke(
    @Body() body: RevokeRequest,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    if (this.hasSessionCookie(request)) {
      this.writeError(response, {
        ok: false,
        status: HttpStatus.BAD_REQUEST,
        error: 'invalid_request',
      });
      return;
    }
    const result = await this.tokens.revoke(
      body,
      request.get(NATIVE_DPOP_PROOF_HEADER),
    );
    response.setHeader('Cache-Control', 'no-store');
    if (!result.ok) {
      if (result.dpopNonce) {
        response.setHeader(NATIVE_DPOP_NONCE_HEADER, result.dpopNonce);
      }
      this.writeError(response, result);
      return;
    }
    response.status(HttpStatus.OK).json({});
  }

  private hasSessionCookie(request: Request): boolean {
    return (
      readSessionCookie(
        request,
        this.config.get<string>('NODE_ENV'),
        this.config.get<string>('session.cookieName'),
      ) !== undefined
    );
  }

  private requireBrowserSession(request: RequestWithUser): string {
    if (
      request.user &&
      request.session?.credentialPurpose === CREDENTIAL_PURPOSE.BROWSER_SESSION
    ) {
      return request.user.id;
    }
    throw new AppException(
      ErrorCode.SESSION_REQUIRED,
      'Authentication required',
      HttpStatus.UNAUTHORIZED,
    );
  }

  private writeToken(
    response: Response,
    result: TokenSuccess | OauthFailure,
  ): void {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Pragma', 'no-cache');
    if (!result.ok) {
      if (result.dpopNonce) {
        response.setHeader(NATIVE_DPOP_NONCE_HEADER, result.dpopNonce);
      }
      this.writeError(response, result);
      return;
    }
    response.status(HttpStatus.OK).json({
      access_token: result.accessToken,
      token_type: result.tokenType,
      expires_in: result.expiresIn,
      refresh_token: result.refreshToken,
      scope: result.scope,
    });
  }

  private writeError(response: Response, result: OauthFailure): void {
    response.setHeader('Cache-Control', 'no-store');
    if (result.error_description === undefined) {
      response.status(result.status).json({ error: result.error });
      return;
    }
    response.status(result.status).json({
      error: result.error,
      error_description: result.error_description,
    });
  }
}
