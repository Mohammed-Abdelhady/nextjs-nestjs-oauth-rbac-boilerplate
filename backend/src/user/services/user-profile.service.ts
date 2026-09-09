import { Injectable, Logger, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from '../schemas/user.schema';
import { Role, RoleDocument } from '../../role/schemas/role.schema';
// feature:passkeys:start
import {
  Passkey,
  PasskeyDocument,
} from '../../auth/passkeys/schemas/passkey.schema';
// feature:passkeys:end
import { SessionService } from '../../auth/services/session.service';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { UserProfileDto } from '../dto/user-profile.dto';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/enums/error-code.enum';
import { ApiResponse } from '../../common/dto/api-response.dto';
import { getEffectivePermissions } from '../../auth/utils/permissions.util';
import {
  PASSWORD_SALT_ROUNDS,
  USER_HIDDEN_FIELDS,
} from '../constants/user.constants';
import {
  assertActiveUser,
  assertValidObjectId,
} from '../utils/user-lookup.util';

/**
 * Self-service profile operations: reading and updating the profile,
 * changing the password, and deactivating the account.
 */
@Injectable()
export class UserProfileService {
  private readonly logger = new Logger(UserProfileService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Role.name) private readonly roleModel: Model<RoleDocument>,
    // feature:passkeys:start
    @InjectModel(Passkey.name)
    private readonly passkeyModel: Model<PasskeyDocument>,
    // feature:passkeys:end
    private readonly sessionService: SessionService,
  ) {}

  /**
   * Get current user profile.
   */
  async getProfile(userId: string): Promise<ApiResponse<UserProfileDto>> {
    assertValidObjectId(userId, 'Invalid user ID format');

    const user = await this.userModel
      .findById(userId)
      .select(USER_HIDDEN_FIELDS)
      .exec();

    assertActiveUser(user);

    this.logger.log(`Profile retrieved for user: ${user.email}`);
    const profileDto = await this.mapToProfileDto(user);
    return ApiResponse.success(profileDto);
  }

  /**
   * Update current user profile.
   */
  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<ApiResponse<UserProfileDto>> {
    assertValidObjectId(userId, 'Invalid user ID format');

    const user = await this.userModel.findById(userId).exec();
    assertActiveUser(user);

    // Update only provided fields
    if (dto.name !== undefined) {
      user.name = dto.name;
    }

    await user.save();

    this.logger.log(`Profile updated for user: ${user.email}`);
    const profileDto = await this.mapToProfileDto(user);
    return ApiResponse.success(profileDto, 'Profile updated successfully');
  }

  /**
   * Change user password.
   */
  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
    currentSessionToken: string,
  ): Promise<ApiResponse<{ message: string }>> {
    assertValidObjectId(userId, 'Invalid user ID format');

    const user = await this.userModel
      .findById(userId)
      .select('+password')
      .exec();

    assertActiveUser(user);

    // Check if user has a password (OAuth users might not)
    if (!user.password) {
      throw new AppException(
        ErrorCode.INVALID_CURRENT_PASSWORD,
        'Cannot change password for OAuth-only accounts',
        HttpStatus.BAD_REQUEST,
      );
    }

    const isPasswordValid = await bcrypt.compare(
      dto.currentPassword,
      user.password,
    );

    if (!isPasswordValid) {
      throw new AppException(
        ErrorCode.INVALID_CURRENT_PASSWORD,
        'Current password is incorrect',
        HttpStatus.BAD_REQUEST,
      );
    }

    const isSamePassword = await bcrypt.compare(dto.newPassword, user.password);

    if (isSamePassword) {
      throw new AppException(
        ErrorCode.SAME_PASSWORD,
        'New password must be different from current password',
        HttpStatus.BAD_REQUEST,
      );
    }

    user.password = await bcrypt.hash(dto.newPassword, PASSWORD_SALT_ROUNDS);
    await user.save();

    // Invalidate all other sessions (keep current session)
    await this.sessionService.invalidateAllSessionsExcept(
      new Types.ObjectId(userId),
      currentSessionToken,
    );

    this.logger.log(`Password changed for user: ${user.email}`);
    return ApiResponse.success({
      message:
        'Password changed successfully. Other sessions have been logged out.',
    });
  }

  /**
   * Soft delete (deactivate) own account.
   */
  async deactivateAccount(
    userId: string,
  ): Promise<ApiResponse<{ message: string }>> {
    const user = await this.userModel.findById(userId).exec();
    assertActiveUser(user);

    user.isDeleted = true;
    user.deletedAt = new Date();
    await user.save();

    await this.sessionService.invalidateAllSessions(new Types.ObjectId(userId));

    this.logger.log(`Account deactivated for user: ${user.email}`);
    return ApiResponse.success({
      message: 'Account deactivated successfully',
    });
  }

  /**
   * Provider a user syncs its profile from, if any.
   */
  async getPrimaryProvider(userId: string): Promise<string | undefined> {
    const user = await this.userModel
      .findById(userId)
      .select('primaryProvider')
      .exec();

    return user?.primaryProvider;
  }

  /**
   * Map user document to profile DTO.
   */
  private async mapToProfileDto(user: UserDocument): Promise<UserProfileDto> {
    // Compute effective permissions (role + direct)
    const effectivePermissions = await getEffectivePermissions(
      user,
      this.roleModel,
    );
    // feature:passkeys:start
    const passkeyCount = await this.passkeyModel.countDocuments({
      user: user._id,
    });
    // feature:passkeys:end

    return {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      permissions: effectivePermissions,
      authProvider: user.authProvider,
      isVerified: user.isVerified,
      twoFactorEnabled: user.twoFactor?.enabled === true, // feature:totp
      passkeyCount, // feature:passkeys
      avatarUrl: user.avatarUrl,
      linkedProviders: user.linkedProviders,
      primaryProvider: user.primaryProvider,
      profileSyncedAt: user.profileSyncedAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
