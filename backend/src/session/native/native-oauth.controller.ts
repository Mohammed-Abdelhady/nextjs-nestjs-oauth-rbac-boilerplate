import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { Public } from '../../auth/decorators/public.decorator';
import { SkipBrowserProof } from '../../auth/decorators/skip-browser-proof.decorator';
import { RequestWithUser } from '../../auth/guards/auth.guard';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/enums/error-code.enum';
import { AuthEpochService } from '../../common/services/auth-epoch.service';
import { NativeAuthorizeService } from './native-authorize.service';
import { NativeTokenService } from './native-token.service';
import {
  AuthorizeQuery,
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

@Controller('oauth')
export class NativeOAuthController {
  constructor(
    private readonly authorize: NativeAuthorizeService,
    private readonly tokens: NativeTokenService,
    private readonly config: ConfigService,
    private readonly authEpoch: AuthEpochService,
  ) {}

  @Public()
  @SkipBrowserProof()
  @Get('authorize')
  async authorizeGet(
    @Query() query: AuthorizeQuery,
    @Res() response: Response,
  ): Promise<void> {
    const result = await this.authorize.begin(query);
    if (!result.ok) {
      this.writeError(response, result);
      return;
    }
    const login = new URL('/login', this.authEpoch.clientUrl());
    login.searchParams.set('native_transaction', result.transactionId);
    response.redirect(login.toString());
  }

  @Post('authorize/approve')
  async approve(
    @Body() body: { transactionId?: string },
    @Req() request: RequestWithUser,
    @Res() response: Response,
  ): Promise<void> {
    const transactionId = body.transactionId?.trim() ?? '';
    if (!request.user || !transactionId) {
      throw new AppException(
        ErrorCode.VALIDATION_ERROR,
        'Authorization approval is incomplete',
        HttpStatus.BAD_REQUEST,
      );
    }
    const approved = await this.authorize.approve(
      request.user.id,
      transactionId,
      request.session?.authenticationMethods ?? [],
    );
    if ('ok' in approved) {
      this.writeError(response, approved);
      return;
    }
    response.status(HttpStatus.OK).json({ success: true, data: approved });
  }

  @Public()
  @SkipBrowserProof()
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
    const result = await this.tokens.grant(body, {
      ip: requestIp(request),
      userAgent: requestUserAgent(request),
    });
    this.writeToken(response, result);
  }

  @Public()
  @SkipBrowserProof()
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
    const result = await this.tokens.revoke(body);
    response.setHeader('Cache-Control', 'no-store');
    if (!result.ok) {
      response.status(result.status).json({ error: result.error });
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

  private writeToken(
    response: Response,
    result: TokenSuccess | OauthFailure,
  ): void {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Pragma', 'no-cache');
    if (!result.ok) {
      this.writeError(response, result);
      return;
    }
    response.status(HttpStatus.OK).json({
      access_token: result.accessToken,
      token_type: 'Bearer',
      expires_in: result.expiresIn,
      refresh_token: result.refreshToken,
      scope: result.scope,
    });
  }

  private writeError(response: Response, result: OauthFailure): void {
    response.setHeader('Cache-Control', 'no-store');
    response.status(result.status).json({ error: result.error });
  }
}
