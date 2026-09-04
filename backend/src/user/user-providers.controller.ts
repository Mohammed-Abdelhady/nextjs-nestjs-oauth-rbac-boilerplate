import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UserProfileService } from './services/user-profile.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserProfileDto } from './dto/user-profile.dto';
import {
  LinkProviderDto,
  SetPrimaryProviderDto,
  LinkedProvidersResponseDto,
} from './dto/account-linking.dto';
import { ApiResponse } from '../common/dto/api-response.dto';
import { AccountLinkingService } from './services/account-linking.service';
import { ProfileSyncService } from './services/profile-sync.service';
import { OAuthService, OAuthProvider } from '../auth/services/oauth.service';
import { AuthProvider } from './enums/auth-provider.enum';

/**
 * Controller for OAuth provider linking and profile synchronization.
 * All endpoints require authentication.
 */
@ApiTags('user')
@ApiBearerAuth('JWT-auth')
@Controller('user')
@UseGuards(AuthGuard)
export class UserProvidersController {
  constructor(
    private readonly userProfileService: UserProfileService,
    private readonly accountLinkingService: AccountLinkingService,
    private readonly oauthService: OAuthService,
    private readonly profileSyncService: ProfileSyncService,
  ) {}

  /**
   * Get all linked providers for current user.
   *
   * @example GET /user/linked-providers
   */
  @Get('linked-providers')
  @ApiOperation({
    summary: 'Get linked providers',
    description:
      'Returns a list of all OAuth providers linked to the authenticated user account.',
  })
  async getLinkedProviders(
    @CurrentUser('id') userId: string,
  ): Promise<ApiResponse<LinkedProvidersResponseDto>> {
    const providers =
      await this.accountLinkingService.getLinkedProviders(userId);

    const primaryProvider =
      await this.userProfileService.getPrimaryProvider(userId);

    return ApiResponse.success({
      providers: providers as string[],
      primaryProvider,
    });
  }

  /**
   * Link a new OAuth provider to current user's account.
   *
   * @example POST /user/link-provider
   */
  @Post('link-provider')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Link OAuth provider',
    description:
      'Links a new OAuth provider (Google, Facebook, GitHub) to the authenticated user account. ' +
      'The email from the OAuth provider must match the user account email.',
  })
  @ApiBody({ type: LinkProviderDto })
  async linkProvider(
    @CurrentUser('id') userId: string,
    @Body() dto: LinkProviderDto,
  ): Promise<ApiResponse<UserProfileDto>> {
    // Get OAuth user profile using the provider code
    // AuthProvider and OAuthProvider use same lowercase values for OAuth providers
    const profile = await this.oauthService.getUserProfile(
      dto.provider.toLowerCase() as OAuthProvider,
      dto.code,
      dto.state,
    );

    // Link the provider to user account
    await this.accountLinkingService.linkProvider(
      userId,
      dto.provider,
      profile,
    );

    // Return updated user profile
    return this.userProfileService.getProfile(userId);
  }

  /**
   * Unlink an OAuth provider from current user's account.
   *
   * @example DELETE /user/unlink-provider/:provider
   */
  @Delete('unlink-provider/:provider')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Unlink OAuth provider',
    description:
      'Unlinks an OAuth provider from the authenticated user account. ' +
      'Cannot unlink the last authentication method.',
  })
  @ApiParam({
    name: 'provider',
    description: 'OAuth provider to unlink',
    enum: ['GOOGLE', 'FACEBOOK', 'GITHUB'],
    example: 'GITHUB',
  })
  async unlinkProvider(
    @CurrentUser('id') userId: string,
    @Param('provider') provider: string,
  ): Promise<ApiResponse<UserProfileDto>> {
    // Convert string to AuthProvider enum (provider comes as uppercase from route)
    const authProvider = provider.toLowerCase() as AuthProvider;

    // Unlink the provider
    await this.accountLinkingService.unlinkProvider(userId, authProvider);

    // Return updated user profile
    return this.userProfileService.getProfile(userId);
  }

  /**
   * Set primary provider for profile synchronization.
   *
   * @example POST /user/set-primary-provider
   */
  @Post('set-primary-provider')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Set primary provider',
    description:
      'Sets an OAuth provider as the primary provider for automatic profile synchronization. ' +
      'The provider must already be linked to the account.',
  })
  @ApiBody({ type: SetPrimaryProviderDto })
  async setPrimaryProvider(
    @CurrentUser('id') userId: string,
    @Body() dto: SetPrimaryProviderDto,
  ): Promise<ApiResponse<UserProfileDto>> {
    // Set primary provider
    await this.accountLinkingService.setPrimaryProvider(userId, dto.provider);

    // Return updated user profile
    return this.userProfileService.getProfile(userId);
  }

  /**
   * Get profile sync status for current user.
   *
   * @example GET /user/sync-status
   */
  @Get('sync-status')
  @ApiOperation({
    summary: 'Get profile sync status',
    description:
      'Returns profile synchronization status including last sync timestamp and primary provider.',
  })
  async getSyncStatus(@CurrentUser('id') userId: string): Promise<
    ApiResponse<{
      lastSyncedAt?: Date;
      lastSyncedProvider?: string;
      primaryProvider?: AuthProvider;
      canSync: boolean;
    }>
  > {
    const status = await this.profileSyncService.getSyncStatus(userId);
    return ApiResponse.success(status);
  }

  /**
   * Initiate manual profile sync from primary provider.
   * Requires user to re-authenticate with OAuth.
   *
   * @example POST /user/sync-profile
   */
  @Post('sync-profile')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Initiate profile sync',
    description:
      'Initiates manual profile synchronization from the primary OAuth provider. ' +
      'Returns instructions to re-authenticate with OAuth for fresh profile data.',
  })
  async initiateProfileSync(@CurrentUser('id') userId: string): Promise<
    ApiResponse<{
      requiresOAuth: boolean;
      provider: AuthProvider;
      message: string;
    }>
  > {
    const syncInstructions =
      await this.profileSyncService.initiateManualSync(userId);
    return ApiResponse.success(syncInstructions);
  }
}
