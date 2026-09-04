import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from '../../user/schemas/user.schema';
import { SessionService } from '../../auth/services/session.service';
import { AdminUserDto } from '../dto/admin-user-response.dto';
import { UpdateUserStatusDto } from '../dto/update-user-status.dto';
import { UpdateUserRoleDto } from '../dto/update-user-role.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { CreateUserDto } from '../dto/create-user.dto';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/enums/error-code.enum';
import { ApiResponse } from '../../common/dto/api-response.dto';
import { ADMIN_PASSWORD_SALT_ROUNDS } from '../constants/admin-user.constants';
import { mapToAdminUserDto } from '../mappers/admin-user.mapper';
import { AdminUserAccessService } from './admin-user-access.service';
import { AdminEmailChangeService } from './admin-email-change.service';

/**
 * Mutating user operations for the admin area.
 * Every one of them needs the actor's level to exceed the target's level.
 */
@Injectable()
export class AdminUsersService {
  private readonly logger = new Logger(AdminUsersService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly sessionService: SessionService,
    private readonly accessService: AdminUserAccessService,
    private readonly emailChangeService: AdminEmailChangeService,
  ) {}

  /**
   * Create a user. The role must exist and sit below the actor's level.
   */
  async createUser(
    dto: CreateUserDto,
    actorRole: string,
  ): Promise<ApiResponse<AdminUserDto>> {
    const { email, name, password, role } = dto;

    const existingUser = await this.userModel.findOne({ email }).exec();
    if (existingUser) {
      throw new AppException(
        ErrorCode.EMAIL_ALREADY_EXISTS,
        'Email already in use',
        HttpStatus.CONFLICT,
      );
    }

    await this.accessService.assertCanAssignRole(actorRole, role);

    const newUser = new this.userModel({
      email,
      name,
      password: await bcrypt.hash(password, ADMIN_PASSWORD_SALT_ROUNDS),
      role,
      isVerified: true, // Admin-created users are auto-verified
      permissions: [],
      authProvider: 'email',
    });

    await newUser.save();
    this.logger.log(`User created by admin: ${newUser.email} as ${role}`);

    return ApiResponse.success(
      mapToAdminUserDto(newUser),
      'User created successfully',
    );
  }

  /**
   * Update name and email. Changing the email is admin-only and sends the
   * account back through verification.
   */
  async updateUser(
    id: string,
    dto: UpdateUserDto,
    actorId: string,
    actorRole: string,
  ): Promise<ApiResponse<AdminUserDto>> {
    const { name, email } = dto;
    const targetUser = await this.accessService.loadActiveUser(id);

    this.accessService.assertNotSelf(
      id,
      actorId,
      'Cannot modify your own account through admin panel',
    );
    await this.accessService.assertCanModify(actorRole, targetUser.role);

    if (name !== undefined) {
      targetUser.name = name;
    }

    if (email && email !== targetUser.email) {
      const actorLevel = await this.accessService.getActorLevel(actorRole);
      await this.emailChangeService.apply(targetUser, email, actorLevel);
    }

    await targetUser.save();
    this.logger.log(`User ${id} updated by ${actorId}`);

    return ApiResponse.success(
      mapToAdminUserDto(targetUser),
      'User updated successfully',
    );
  }

  /**
   * Activate or deactivate an account.
   */
  async updateUserStatus(
    id: string,
    dto: UpdateUserStatusDto,
    actorId: string,
    actorRole: string,
  ): Promise<
    ApiResponse<{ id: string; isDeleted: boolean; deletedAt?: Date }>
  > {
    const { isActive } = dto;
    const targetUser = await this.accessService.loadActiveUser(id);

    this.accessService.assertNotSelf(
      id,
      actorId,
      'Cannot modify your own account',
    );
    await this.accessService.assertCanModify(actorRole, targetUser.role);

    targetUser.isDeleted = !isActive;
    targetUser.deletedAt = isActive ? undefined : new Date();
    await targetUser.save();

    if (!isActive) {
      await this.sessionService.invalidateAllSessions(new Types.ObjectId(id));
    }

    this.logger.log(
      `User ${id} set ${isActive ? 'active' : 'inactive'} by ${actorId}`,
    );

    return ApiResponse.success({
      id: targetUser._id.toString(),
      isDeleted: targetUser.isDeleted,
      deletedAt: targetUser.deletedAt,
    });
  }

  /**
   * Move a user to another role, system or custom.
   */
  async updateUserRole(
    id: string,
    dto: UpdateUserRoleDto,
    actorId: string,
    actorRole: string,
  ): Promise<ApiResponse<{ id: string; role: string }>> {
    const { role: newRole } = dto;
    const targetUser = await this.accessService.loadActiveUser(id);

    this.accessService.assertNotSelf(
      id,
      actorId,
      'Cannot modify your own role',
    );
    await this.accessService.assertCanModify(actorRole, targetUser.role);
    await this.accessService.assertCanAssignRole(actorRole, newRole);

    targetUser.role = newRole;
    await targetUser.save();

    // Permissions travel with the role, so existing sessions must be rebuilt
    await this.sessionService.invalidateAllSessions(new Types.ObjectId(id));
    this.logger.log(`User ${id} role changed to ${newRole} by ${actorId}`);

    return ApiResponse.success({
      id: targetUser._id.toString(),
      role: newRole,
    });
  }

  /**
   * Soft delete a user.
   */
  async deleteUser(
    id: string,
    actorId: string,
    actorRole: string,
  ): Promise<void> {
    const targetUser = await this.userModel.findById(id).exec();

    if (!targetUser || targetUser.isDeleted) {
      throw new AppException(
        ErrorCode.USER_ALREADY_DELETED,
        'User not found or already deleted',
        HttpStatus.BAD_REQUEST,
      );
    }

    this.accessService.assertNotSelf(
      id,
      actorId,
      'Cannot delete your own account',
    );
    await this.accessService.assertCanModify(
      actorRole,
      targetUser.role,
      'Cannot delete user with higher or equal role',
    );

    targetUser.isDeleted = true;
    targetUser.deletedAt = new Date();
    await targetUser.save();

    await this.sessionService.invalidateAllSessions(new Types.ObjectId(id));
    this.logger.log(`User ${id} deleted by ${actorId}`);
  }
}
