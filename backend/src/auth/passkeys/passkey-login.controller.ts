import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { PasskeyLoginService } from './services/passkey-login.service';
import { PasskeyLoginOptionsDto } from './dto/passkey-login-options.dto';
import { VerifyPasskeyLoginDto } from './dto/verify-passkey-login.dto';
import { PasskeyRequestOptions } from './services/webauthn.adapter';
import { LoginResponseDto } from '../dto/login-response.dto';
import { Public } from '../decorators/public.decorator';
import { RequiresFeature } from '../decorators/requires-feature.decorator';
import { AuthFeature } from '../enums/auth-feature.enum';
import { ApiResponse } from '../../common/dto/api-response.dto';
import { THROTTLE_PASSKEY_LOGIN } from '../../common/constants/throttle';

/**
 * Signing in with a passkey. Both routes are open: there is no session yet,
 * and the challenge cookie is what ties the two halves together.
 */
@ApiTags('auth')
@Controller('auth/passkeys/login')
@RequiresFeature(AuthFeature.PASSKEYS)
export class PasskeyLoginController {
  constructor(private readonly loginService: PasskeyLoginService) {}

  /**
   * Start a passkey sign-in
   * POST /api/auth/passkeys/login/options
   */
  @Public()
  @Throttle(THROTTLE_PASSKEY_LOGIN)
  @Post('options')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Options for signing in with a passkey',
    description:
      'Returns the options for navigator.credentials.get() and leaves the ' +
      'challenge in a five minute cookie. The browser picks a discoverable ' +
      'credential, so no address is needed; one sent in the body is ignored, ' +
      'and the reply is the same whether or not it has an account.',
  })
  @ApiBody({ type: PasskeyLoginOptionsDto, required: false })
  async options(
    @Body() _dto: PasskeyLoginOptionsDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ApiResponse<PasskeyRequestOptions>> {
    return this.loginService.createOptions(response);
  }

  /**
   * Finish a passkey sign-in
   * POST /api/auth/passkeys/login/verify
   */
  @Public()
  @Throttle(THROTTLE_PASSKEY_LOGIN)
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sign in with a passkey',
    description:
      'Checks the signed challenge against the stored credential, then sets ' +
      'the session cookie. A passkey that verified the user counts as the ' +
      'second factor; one that only proved possession still owes a TOTP code ' +
      'when the account has one.',
  })
  @ApiBody({ type: VerifyPasskeyLoginDto })
  async verify(
    @Body() dto: VerifyPasskeyLoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ApiResponse<LoginResponseDto>> {
    return this.loginService.verify(dto, request, response);
  }
}
