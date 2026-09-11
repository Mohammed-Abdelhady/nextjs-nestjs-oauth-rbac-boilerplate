import {
  Controller,
  Post,
  Body,
  Res,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { ActivateDto } from './dto/activate.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ResendActivationDto } from './dto/resend-activation.dto';
import { Public } from './decorators/public.decorator';
import { RequiresFeature } from './decorators/requires-feature.decorator';
import { AuthFeature } from './enums/auth-feature.enum';
import { Throttle } from '@nestjs/throttler';
import { SessionCookieService } from './services/session-cookie.service';
import {
  THROTTLE_LOGIN,
  THROTTLE_FORGOT_PASSWORD,
  THROTTLE_RESET_PASSWORD,
  THROTTLE_ACTIVATE,
  THROTTLE_REGISTER,
} from '../common/constants/throttle';

/**
 * Password sign-in and the account lifecycle around it.
 *
 * The four routes that need a password close with AUTH_PASSWORD_ENABLED=false.
 * Activation, resend and logout stay open: an activation code also confirms an
 * address an admin moved an account to, which has nothing to do with passwords.
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessionCookieService: SessionCookieService,
  ) {}

  /**
   * Register a new user
   * POST /api/auth/register
   */
  @Public()
  @RequiresFeature(AuthFeature.PASSWORD)
  @Throttle(THROTTLE_REGISTER)
  @Post('register')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Register a new user',
    description:
      'Creates a new user account with email, password, and name. ' +
      'An activation code will be sent to provided email address.',
  })
  @ApiBody({ type: RegisterDto })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  /**
   * Activate account with email and code
   * POST /api/auth/activate
   */
  @Public()
  @Throttle(THROTTLE_ACTIVATE)
  @Post('activate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Activate user account',
    description:
      'Activates a user account using email address and 6-digit activation code ' +
      'sent to user during registration.',
  })
  @ApiBody({ type: ActivateDto })
  async activate(@Body() dto: ActivateDto, @Res() response: Response) {
    const result = await this.authService.activate(dto, response);
    return response.status(HttpStatus.OK).json(result);
  }

  /**
   * Resend activation code
   * POST /api/auth/resend-activation
   */
  @Public()
  @Throttle({ default: { limit: 3, ttl: 3600000 } })
  @Post('resend-activation')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resend activation code',
    description:
      'Sends a new 6-digit activation code to the provided email address. ' +
      'Rate limited to 3 requests per hour per client IP.',
  })
  @ApiBody({ type: ResendActivationDto })
  async resendActivation(@Body() dto: ResendActivationDto) {
    return this.authService.resendActivation(dto);
  }

  /**
   * Login user with email and password
   * POST /api/auth/login
   */
  @Public()
  @RequiresFeature(AuthFeature.PASSWORD)
  @Throttle(THROTTLE_LOGIN)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login user',
    description:
      'Authenticates a user with email and password. ' +
      'Returns JWT token and sets session cookie upon successful authentication.',
  })
  @ApiBody({ type: LoginDto })
  async login(@Body() dto: LoginDto, @Res() response: Response) {
    const result = await this.authService.login(dto, response);
    return response.status(HttpStatus.OK).json(result);
  }

  /**
   * Logout user by invalidating session
   * POST /api/auth/logout
   * Requires authentication
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Logout user',
    description:
      'Invalidates current user session and clears session cookie. ' +
      'Requires JWT authentication.',
  })
  async logout(@Req() request: Request, @Res() response: Response) {
    const sessionToken = this.sessionCookieService.read(request) ?? '';

    const result = await this.authService.logout(sessionToken);

    this.sessionCookieService.clear(response);

    return response.status(HttpStatus.OK).json(result);
  }

  /**
   * Request password reset code
   * POST /api/auth/forgot-password
   */
  @Public()
  @RequiresFeature(AuthFeature.PASSWORD)
  @Throttle(THROTTLE_FORGOT_PASSWORD)
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request password reset',
    description:
      'Sends a 6-digit password reset code to the user email address. ' +
      'The code expires in 15 minutes.',
  })
  @ApiBody({ type: ForgotPasswordDto })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  /**
   * Reset password with email and code
   * POST /api/auth/reset-password
   */
  @Public()
  @RequiresFeature(AuthFeature.PASSWORD)
  @Throttle(THROTTLE_RESET_PASSWORD)
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset password',
    description:
      'Resets user password using email address and 6-digit reset code. ' +
      'The code must be valid and not expired.',
  })
  @ApiBody({ type: ResetPasswordDto })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }
}
