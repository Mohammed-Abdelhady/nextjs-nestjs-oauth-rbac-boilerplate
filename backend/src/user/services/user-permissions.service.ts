import { Injectable, Logger, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../schemas/user.schema';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/enums/error-code.enum';
import { ApiResponse } from '../../common/dto/api-response.dto';
import {
  assertActiveUser,
  assertValidObjectId,
} from '../utils/user-lookup.util';

interface UserPermissionsData {
  userId: string;
  permissions: string[];
}

interface UserPermissionsWithRole extends UserPermissionsData {
  role: string;
}

/**
 * Direct permission grants held on the user document.
 * Role permissions are resolved separately, see auth/utils/permissions.util.
 */
@Injectable()
export class UserPermissionsService {
  private readonly logger = new Logger(UserPermissionsService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  /**
   * Get the direct permissions and role of a user.
   */
  async getUserPermissions(
    userId: string,
  ): Promise<ApiResponse<UserPermissionsWithRole>> {
    assertValidObjectId(userId, 'Invalid user ID format');

    const user = await this.userModel
      .findById(userId)
      .select('permissions role')
      .exec();

    assertActiveUser(user);

    return ApiResponse.success({
      userId: user._id.toString(),
      permissions: user.permissions || [],
      role: user.role,
    });
  }

  /**
   * Add permission to user.
   */
  async addPermission(
    userId: string,
    permission: string,
  ): Promise<ApiResponse<UserPermissionsData>> {
    assertValidObjectId(userId, 'Invalid user ID format');

    const user = await this.userModel.findById(userId).exec();
    assertActiveUser(user);

    if (user.permissions.includes(permission)) {
      throw new AppException(
        ErrorCode.PERMISSION_ALREADY_EXISTS,
        'User already has this permission',
        HttpStatus.BAD_REQUEST,
      );
    }

    user.permissions.push(permission);
    await user.save();

    this.logger.log(`Permission ${permission} added to user: ${user.email}`);
    return ApiResponse.success(
      {
        userId: user._id.toString(),
        permissions: user.permissions,
      },
      'Permission added successfully',
    );
  }

  /**
   * Remove permission from user.
   */
  async removePermission(
    userId: string,
    permission: string,
  ): Promise<ApiResponse<UserPermissionsData>> {
    assertValidObjectId(userId, 'Invalid user ID format');

    const user = await this.userModel.findById(userId).exec();
    assertActiveUser(user);

    if (!user.permissions.includes(permission)) {
      throw new AppException(
        ErrorCode.PERMISSION_NOT_FOUND,
        'User does not have this permission',
        HttpStatus.NOT_FOUND,
      );
    }

    user.permissions = user.permissions.filter((p) => p !== permission);
    await user.save();

    this.logger.log(
      `Permission ${permission} removed from user: ${user.email}`,
    );
    return ApiResponse.success(
      {
        userId: user._id.toString(),
        permissions: user.permissions,
      },
      'Permission removed successfully',
    );
  }
}
