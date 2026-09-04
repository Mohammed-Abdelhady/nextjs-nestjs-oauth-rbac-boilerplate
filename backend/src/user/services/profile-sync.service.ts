import { Injectable, Logger, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { User, UserDocument } from '../schemas/user.schema';
import { AuthProvider } from '../enums/auth-provider.enum';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/enums/error-code.enum';
import { OAuthUserProfile } from '../../auth/strategies/oauth.strategy.interface';

/**
 * Profile Sync Service
 * Handles automatic profile synchronization from OAuth providers
 */
@Injectable()
export class ProfileSyncService {
  private readonly logger = new Logger(ProfileSyncService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Sync user profile from OAuth provider data
   * Called during OAuth login to keep profile up-to-date
   *
   * @param userId - User ID to sync
   * @param provider - OAuth provider
   * @param profile - OAuth user profile from provider
   * @returns Updated user document
   */
  async syncProfileFromProvider(
    userId: string,
    provider: AuthProvider,
    profile: OAuthUserProfile,
  ): Promise<UserDocument> {
    const user = await this.userModel.findById(userId);

    if (!user) {
      throw new AppException(
        ErrorCode.USER_NOT_FOUND,
        ErrorCode.USER_NOT_FOUND,
        HttpStatus.NOT_FOUND,
      );
    }

    // Only sync if this is the primary provider or no primary is set
    const shouldSync =
      !user.primaryProvider || user.primaryProvider === provider;

    if (!shouldSync) {
      this.logger.debug(
        `Skipping profile sync for user ${userId} - ${provider} is not primary provider`,
      );
      return user;
    }

    // Get sync fields from configuration (default: name, picture)
    const rawFields =
      this.configService.get<string>('profileSync.fields') ||
      this.configService.get<string>('PROFILE_SYNC_FIELDS', 'name,picture');
    const syncFields = rawFields
      .split(',')
      .map((field: string): string => field.trim())
      .filter(Boolean);

    let updated = false;

    // Sync name if configured
    if (
      syncFields.includes('name') &&
      profile.name &&
      profile.name !== user.name
    ) {
      user.name = profile.name;
      updated = true;
      this.logger.log(
        `Updated name for user ${userId} from ${provider}: ${profile.name}`,
      );
    }

    // Note: Email sync is intentionally excluded for security
    // Email changes require verification flow

    // Sync avatar/picture if configured
    // TODO: Implement avatar storage when user schema supports it
    // if (syncFields.includes('picture') && profile.picture) {
    //   user.avatar = profile.picture;
    //   updated = true;
    // }

    if (updated) {
      user.profileSyncedAt = new Date();
      user.lastSyncedProvider = provider;
      await user.save();
      this.logger.log(`Profile synced for user ${userId} from ${provider}`);
    }

    return user;
  }

  /**
   * Manual profile sync from primary provider
   * Requires user to re-authenticate with OAuth to get fresh data
   *
   * @param userId - User ID to sync
   * @returns Sync instructions for frontend
   */
  async initiateManualSync(userId: string): Promise<{
    requiresOAuth: boolean;
    provider: AuthProvider;
    message: string;
  }> {
    const user = await this.userModel
      .findById(userId)
      .select('primaryProvider linkedProviders');

    if (!user) {
      throw new AppException(
        ErrorCode.USER_NOT_FOUND,
        ErrorCode.USER_NOT_FOUND,
        HttpStatus.NOT_FOUND,
      );
    }

    // Determine which provider to sync from
    const syncProvider = user.primaryProvider || AuthProvider.EMAIL;

    // If provider is EMAIL (email/password), no sync possible
    if (syncProvider === AuthProvider.EMAIL) {
      throw new AppException(
        ErrorCode.PROVIDER_NOT_LINKED,
        ErrorCode.PROVIDER_NOT_LINKED,
        HttpStatus.BAD_REQUEST,
      );
    }

    // Return instructions to re-authenticate via OAuth
    return {
      requiresOAuth: true,
      provider: syncProvider,
      message: `Please sign in with ${syncProvider} to sync your profile`,
    };
  }

  /**
   * Get profile sync status for a user
   *
   * @param userId - User ID
   * @returns Sync status information
   */
  async getSyncStatus(userId: string): Promise<{
    lastSyncedAt?: Date;
    lastSyncedProvider?: string;
    primaryProvider?: AuthProvider;
    canSync: boolean;
  }> {
    const user = await this.userModel
      .findById(userId)
      .select('profileSyncedAt lastSyncedProvider primaryProvider');

    if (!user) {
      throw new AppException(
        ErrorCode.USER_NOT_FOUND,
        ErrorCode.USER_NOT_FOUND,
        HttpStatus.NOT_FOUND,
      );
    }

    const canSync =
      user.primaryProvider && user.primaryProvider !== AuthProvider.EMAIL;

    return {
      lastSyncedAt: user.profileSyncedAt,
      lastSyncedProvider: user.lastSyncedProvider,
      primaryProvider: user.primaryProvider,
      canSync: Boolean(canSync),
    };
  }

  /**
   * Automatic profile sync cron job
   * Runs daily at 2 AM to sync profiles for users with OAuth primary providers
   *
   * NOTE: This requires storing OAuth refresh tokens for background sync
   * Currently disabled until OAuth token storage is implemented
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM, {
    name: 'profile-sync',
    disabled: true, // Disabled until OAuth token storage implemented
  })
  async scheduleProfileSync(): Promise<void> {
    const isEnabled =
      this.configService.get<boolean>('profileSync.enabled') ??
      this.configService.get<boolean>('PROFILE_SYNC_ENABLED', true);

    if (!isEnabled) {
      this.logger.debug('Automatic profile sync is disabled');
      return;
    }

    this.logger.log('Starting automatic profile sync cron job');

    try {
      // Find users with OAuth primary providers who haven't synced in 24 hours
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const usersToSync = await this.userModel
        .find({
          primaryProvider: { $ne: AuthProvider.EMAIL },
          $or: [
            { profileSyncedAt: { $lt: oneDayAgo } },
            { profileSyncedAt: { $exists: false } },
          ],
        })
        .limit(100) // Process in batches
        .select('_id primaryProvider');

      this.logger.log(`Found ${usersToSync.length} users to sync`);

      // TODO: Implement background sync with stored OAuth refresh tokens
      // For each user:
      // 1. Get stored OAuth refresh token
      // 2. Refresh access token
      // 3. Fetch profile from provider
      // 4. Update user profile
      // 5. Update profileSyncedAt timestamp

      this.logger.log('Automatic profile sync completed');
    } catch (error) {
      this.logger.error(
        `Automatic profile sync failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Handle profile conflicts when syncing from multiple providers
   * Uses primary provider as source of truth
   *
   * @param userId - User ID
   * @param profiles - Map of provider to profile data
   * @returns Resolved profile data
   */
  async resolveConflicts(
    userId: string,
    profiles: Map<AuthProvider, Partial<OAuthUserProfile>>,
  ): Promise<Partial<OAuthUserProfile>> {
    const user = await this.userModel
      .findById(userId)
      .select('primaryProvider');

    if (!user) {
      throw new AppException(
        ErrorCode.USER_NOT_FOUND,
        ErrorCode.USER_NOT_FOUND,
        HttpStatus.NOT_FOUND,
      );
    }

    // Use primary provider as source of truth
    const primaryProvider = user.primaryProvider || AuthProvider.EMAIL;
    const primaryProfile = profiles.get(primaryProvider);

    if (primaryProfile) {
      this.logger.log(
        `Resolved conflicts for user ${userId} using primary provider ${primaryProvider}`,
      );
      return primaryProfile;
    }

    // Fallback: use first available profile
    const firstProfile = Array.from(profiles.values())[0];
    this.logger.warn(
      `Primary provider ${primaryProvider} profile not found for user ${userId}, using fallback`,
    );

    return firstProfile || {};
  }
}
