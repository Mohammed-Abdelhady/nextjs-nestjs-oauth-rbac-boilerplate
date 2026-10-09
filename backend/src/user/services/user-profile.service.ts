import { Injectable, Logger, HttpStatus } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from '../schemas/user.schema';
import { UserRole } from '../enums/user-role.enum';
import { Role, RoleDocument } from '../../role/schemas/role.schema';
// feature:passkeys:start
import {
  Passkey,
  PasskeyDocument,
} from '../../auth/passkeys/schemas/passkey.schema';
// feature:passkeys:end
import { SessionService } from '../../auth/services/sessions/session.service';
import { withMajorityTransaction } from '../../session/utils/transactions/mongo-transaction';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { UserProfileDto } from '../dto/user-profile.dto';
import { AppException } from '../../common/exceptions/app.exception';
import { Clock } from '../../common/services/clock';
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
    @InjectConnection() private readonly connection: Connection,
    private readonly clock: Clock,
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

    this.logger.log(`Profile retrieved: userId=${user._id.toString()}`);
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

    this.logger.log(`Profile updated: userId=${user._id.toString()}`);
    const profileDto = await this.mapToProfileDto(user);
    return ApiResponse.success(profileDto, 'Profile updated successfully');
  }

  /**
   * Change user password.
   */
  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
    currentSessionId: string | null,
  ): Promise<ApiResponse<{ message: string }>> {
    assertValidObjectId(userId, 'Invalid user ID format');

    if (currentSessionId === null) {
      throw new AppException(
        ErrorCode.SESSION_INVALID,
        'Current session is no longer active',
        HttpStatus.UNAUTHORIZED,
      );
    }

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

    const hashedPassword = await bcrypt.hash(
      dto.newPassword,
      PASSWORD_SALT_ROUNDS,
    );

    // The password save and the revocation of the other sessions share one
    // transaction: a revocation failure leaves the old password in place.
    // The document is loaded per attempt: one that already saved it has no
    // modified paths left, so a retried attempt would store nothing.
    await withMajorityTransaction(this.connection, async (db) => {
      const current = await this.userModel.findById(userId).session(db).exec();
      assertActiveUser(current);
      current.password = hashedPassword;
      await current.save({ session: db });
      await this.sessionService.invalidateAllSessionsExceptSession(
        new Types.ObjectId(userId),
        currentSessionId,
        db,
      );
    });

    this.logger.log(`Password changed: userId=${user._id.toString()}`);
    return ApiResponse.success({
      message:
        'Password changed successfully. Other sessions have been logged out.',
    });
  }

  /**
   * Soft delete (deactivate) own account.
   * The last active admin is refused: nobody else could restore the account.
   */
  async deactivateAccount(
    userId: string,
  ): Promise<ApiResponse<{ message: string }>> {
    // The check, the soft delete and the revocation commit or abort together.
    await withMajorityTransaction(this.connection, async (db) => {
      const user = await this.userModel.findById(userId).session(db).exec();
      assertActiveUser(user);
      if (user.role === (UserRole.ADMIN as string)) {
        await this.assertAnotherActiveAdmin(user._id, db);
      }

      user.isDeleted = true;
      user.deletedAt = this.clock.now();
      await user.save({ session: db });

      await this.sessionService.invalidateAllSessions(user._id, db);
    });

    this.logger.log(`Account deactivated: userId=${userId}`);
    return ApiResponse.success({
      message: 'Account deactivated successfully',
    });
  }

  private async assertAnotherActiveAdmin(
    userId: Types.ObjectId,
    db: ClientSession,
  ): Promise<void> {
    const others = await this.userModel
      .countDocuments({
        _id: { $ne: userId },
        role: UserRole.ADMIN,
        isDeleted: { $ne: true },
      })
      .session(db)
      .exec();
    if (others === 0) {
      throw new AppException(
        ErrorCode.ADMIN_CANNOT_DEACTIVATE_SELF,
        'The last active administrator cannot deactivate their own account',
        HttpStatus.FORBIDDEN,
      );
    }
    // Two admins leaving at once each see the other in their own snapshot.
    // Both write the admin role here, so one conflicts and counts again.
    const fenced = await this.roleModel
      .updateOne(
        { slug: UserRole.ADMIN },
        { $inc: { __v: 1 } },
        { session: db, timestamps: false },
      )
      .exec();
    if (fenced.matchedCount !== 1) {
      throw new AppException(
        ErrorCode.AUTHORITY_UNAVAILABLE,
        'Administrator role is unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
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
