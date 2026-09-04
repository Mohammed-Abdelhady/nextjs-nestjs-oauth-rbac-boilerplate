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
import { MagicLinkService } from './magic-link.service';
import { RequestMagicLinkDto } from './dto/request-magic-link.dto';
import { VerifyMagicLinkDto } from './dto/verify-magic-link.dto';
import { Public } from '../decorators/public.decorator';
import { RequiresFeature } from '../decorators/requires-feature.decorator';
import { AuthFeature } from '../enums/auth-feature.enum';
import {
  THROTTLE_MAGIC_LINK_REQUEST,
  THROTTLE_MAGIC_LINK_VERIFY,
} from '../../common/constants/throttle';

/**
 * Passwordless sign-in routes.
 *
 * The mailed link points at the client, which reads the token and posts it
 * here. There is no GET verify route: a link that signs in on a plain GET is
 * spent by the first mail scanner that follows it.
 */
@ApiTags('auth')
@Controller('auth/magic-link')
@RequiresFeature(AuthFeature.MAGIC_LINK)
export class MagicLinkController {
  constructor(private readonly magicLinkService: MagicLinkService) {}

  /**
   * Request a sign-in link
   * POST /api/auth/magic-link/request
   */
  @Public()
  @Throttle(THROTTLE_MAGIC_LINK_REQUEST)
  @Post('request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request a sign-in link',
    description:
      'Mails a one-time sign-in link. The reply is the same whether or not the ' +
      'address has an account, and whether or not a link was mailed.',
  })
  @ApiBody({ type: RequestMagicLinkDto })
  async request(@Body() dto: RequestMagicLinkDto, @Req() request: Request) {
    return this.magicLinkService.request(dto, request);
  }

  /**
   * Spend a sign-in link
   * POST /api/auth/magic-link/verify
   */
  @Public()
  @Throttle(THROTTLE_MAGIC_LINK_VERIFY)
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sign in with a link token',
    description:
      'Spends the token, sets the session cookie and returns the account. ' +
      'The token works once; a spent or expired one answers MAGIC_LINK_INVALID.',
  })
  @ApiBody({ type: VerifyMagicLinkDto })
  async verify(@Body() dto: VerifyMagicLinkDto, @Res() response: Response) {
    const result = await this.magicLinkService.verify(dto, response);
    return response.status(HttpStatus.OK).json(result);
  }
}
