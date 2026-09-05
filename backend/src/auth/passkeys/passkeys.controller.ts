import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { PasskeyRegistrationService } from './services/passkey-registration.service';
import { PasskeyManagementService } from './services/passkey-management.service';
import { VerifyPasskeyRegistrationDto } from './dto/verify-passkey-registration.dto';
import { RenamePasskeyDto } from './dto/rename-passkey.dto';
import {
  PasskeyListResponseDto,
  PasskeySummaryDto,
} from './dto/passkey-summary.dto';
import { PasskeyCreationOptions } from './services/webauthn.adapter';
import { CurrentUser } from '../decorators/current-user.decorator';
import { RequiresFeature } from '../decorators/requires-feature.decorator';
import { AuthFeature } from '../enums/auth-feature.enum';
import { ApiResponse } from '../../common/dto/api-response.dto';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';

/**
 * Passkeys on an account that is already signed in: adding one, and the list
 * behind the account settings. Signing in with a passkey lives in
 * PasskeyLoginController, which is open.
 */
@ApiTags('auth')
@Controller('auth/passkeys')
@RequiresFeature(AuthFeature.PASSKEYS)
export class PasskeysController {
  constructor(
    private readonly registrationService: PasskeyRegistrationService,
    private readonly managementService: PasskeyManagementService,
  ) {}

  /**
   * Start registering a passkey
   * POST /api/auth/passkeys/register/options
   */
  @Post('register/options')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Options for registering a passkey',
    description:
      'Returns the options to hand to navigator.credentials.create() and ' +
      'leaves the challenge in a five minute cookie. Passkeys already on the ' +
      'account are excluded, so an authenticator holding one says so.',
  })
  async registerOptions(
    @CurrentUser('id') userId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ApiResponse<PasskeyCreationOptions>> {
    return this.registrationService.createOptions(userId, response);
  }

  /**
   * Finish registering a passkey
   * POST /api/auth/passkeys/register/verify
   */
  @Post('register/verify')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Store a registered passkey',
    description:
      'Checks the credential against the challenge cookie, the expected origin ' +
      'and the relying party id, then stores it and returns its summary.',
  })
  @ApiBody({ type: VerifyPasskeyRegistrationDto })
  async registerVerify(
    @CurrentUser('id') userId: string,
    @Body() dto: VerifyPasskeyRegistrationDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ApiResponse<PasskeySummaryDto>> {
    return this.registrationService.verify(userId, dto, request, response);
  }

  /**
   * List the passkeys on the account
   * GET /api/auth/passkeys
   */
  @Get()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'List the passkeys on the account',
    description: 'Newest first. No key material is returned.',
  })
  async list(
    @CurrentUser('id') userId: string,
  ): Promise<ApiResponse<PasskeyListResponseDto>> {
    return this.managementService.list(userId);
  }

  /**
   * Rename a passkey
   * PATCH /api/auth/passkeys/:id
   */
  @Patch(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Rename a passkey',
    description: 'A passkey on another account reads as not found.',
  })
  @ApiParam({ name: 'id', example: '507f1f77bcf86cd799439011' })
  @ApiBody({ type: RenamePasskeyDto })
  async rename(
    @CurrentUser('id') userId: string,
    @Param('id', ParseObjectIdPipe) passkeyId: string,
    @Body() dto: RenamePasskeyDto,
  ): Promise<ApiResponse<PasskeySummaryDto>> {
    return this.managementService.rename(userId, passkeyId, dto);
  }

  /**
   * Remove a passkey
   * DELETE /api/auth/passkeys/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Remove a passkey',
    description:
      'Refused when it is the only passkey and the account has no password, ' +
      'no linked provider and no magic link, which would leave no way in.',
  })
  @ApiParam({ name: 'id', example: '507f1f77bcf86cd799439011' })
  async remove(
    @CurrentUser('id') userId: string,
    @Param('id', ParseObjectIdPipe) passkeyId: string,
  ): Promise<ApiResponse<{ message: string }>> {
    return this.managementService.remove(userId, passkeyId);
  }
}
