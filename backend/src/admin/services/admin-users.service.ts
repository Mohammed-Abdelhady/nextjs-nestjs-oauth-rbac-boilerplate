import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { User, UserDocument } from '../../user/schemas/user.schema';
import { Role, RoleDocument } from '../../role/schemas/role.schema';
import { SecurityEventService } from '../../session/services/security-event.service';
import { SessionService } from '../../auth/services/session.service';
import { withMajorityTransaction } from '../../session/utils/mongo-transaction';
import {
  loadAuthorizedUser,
  logSessionRevocation,
  rethrowOrUnavailable,
} from '../utils/admin-transaction.util';
import { reconcileAssignedRole } from '../utils/admin-role-reconcile.util';
import { REVOKED_REASON } from '../../session/constants/revoked-reason';
import { AdminUserDto } from '../dto/admin-user-response.dto';
import { UpdateUserStatusDto } from '../dto/update-user-status.dto';
import { UpdateUserRoleDto } from '../dto/update-user-role.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/enums/error-code.enum';
import { ApiResponse } from '../../common/dto/api-response.dto';
import { ADMIN_ROLE_CHANGED } from '../constants/admin-user.constants';
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
    @InjectModel(Role.name) private readonly roleModel: Model<RoleDocument>,
    private readonly sessionService: SessionService,
    private readonly events: SecurityEventService,
    private readonly accessService: AdminUserAccessService,
    private readonly emailChangeService: AdminEmailChangeService,
    @InjectConnection() private readonly connection: Connection,
  ) {}

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
   * Re-send the confirmation code for the account's current unverified
   * address, without changing the address or its generation.
   */
  async resendEmailChange(
    id: string,
    actorId: string,
    actorRole: string,
  ): Promise<ApiResponse<{ message: string }>> {
    const targetUser = await this.accessService.loadActiveUser(id);

    this.accessService.assertNotSelf(
      id,
      actorId,
      'Cannot modify your own account through admin panel',
    );
    await this.accessService.assertCanModify(actorRole, targetUser.role);

    const actorLevel = await this.accessService.getActorLevel(actorRole);
    await this.emailChangeService.resend(targetUser, actorLevel);

    this.logger.log(`Email change confirmation resent for ${id} by ${actorId}`);
    return ApiResponse.success({ message: 'Confirmation email sent' });
  }

  /**
   * Activate or deactivate an account.
   */
  async updateUserStatus(
    id: string,
    dto: UpdateUserStatusDto,
    actorId: string,
  ): Promise<
    ApiResponse<{ id: string; isDeleted: boolean; deletedAt?: Date }>
  > {
    const { isActive } = dto;
    const userId = new Types.ObjectId(id);
    await this.accessService.loadActiveUser(id);

    this.accessService.assertNotSelf(
      id,
      actorId,
      'Cannot modify your own account',
    );

    try {
      const outcome = await withMajorityTransaction(
        this.connection,
        async (session) => {
          const current = await loadAuthorizedUser(
            this.userModel,
            this.accessService,
            session,
            id,
            actorId,
          );

          current.isDeleted = !isActive;
          current.deletedAt = isActive ? undefined : new Date();
          await current.save({ session });

          const revoked = isActive
            ? 0
            : await this.sessionService.invalidateAllSessions(userId, session, {
                actorId,
                reasonCode: REVOKED_REASON.ADMIN_FORCED,
              });
          return { current, revoked };
        },
      );

      if (!isActive) {
        logSessionRevocation(this.logger, userId, outcome.revoked);
      }
      this.logger.log(
        `User ${id} set ${isActive ? 'active' : 'inactive'} by ${actorId}`,
      );

      return ApiResponse.success({
        id: outcome.current._id.toString(),
        isDeleted: outcome.current.isDeleted,
        deletedAt: outcome.current.deletedAt,
      });
    } catch (error) {
      rethrowOrUnavailable(error);
    }
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
    const userId = new Types.ObjectId(id);
    await this.accessService.loadActiveUser(id);

    this.accessService.assertNotSelf(
      id,
      actorId,
      'Cannot modify your own role',
    );
    await this.accessService.assertCanAssignRole(actorRole, newRole);

    try {
      const outcome = await withMajorityTransaction(
        this.connection,
        async (session) => {
          const current = await loadAuthorizedUser(
            this.userModel,
            this.accessService,
            session,
            id,
            actorId,
          );

          const assignedRole = await this.roleModel
            .findOne({ slug: newRole })
            .session(session)
            .exec();
          if (!assignedRole) {
            throw new AppException(
              ErrorCode.ROLE_NOT_FOUND,
              `Role "${newRole}" does not exist`,
              HttpStatus.NOT_FOUND,
            );
          }

          await this.accessService.assertFreshActorCanModify(
            actorId,
            assignedRole.slug,
            session,
          );
          const previousRole = await this.roleModel
            .findOne({ slug: current.role })
            .session(session)
            .exec();
          current.role = newRole;
          await current.save({ session });

          // Permissions travel with the role, so existing sessions must be
          // rebuilt in the same transaction as the change.
          const revoked = await this.sessionService.invalidateAllSessions(
            userId,
            session,
            {
              actorId,
              reasonCode: REVOKED_REASON.ADMIN_FORCED,
              roleAssignment: {
                assignedRoleId: assignedRole._id.toString(),
                sessionVersion: current.sessionVersion + 1,
                previousRoleId: previousRole?._id.toString(),
              },
            },
          );
          return {
            current,
            revoked,
            roleId: assignedRole._id,
            previousRoleId: previousRole?._id,
          };
        },
      );

      const liveSlug = await reconcileAssignedRole({
        connection: this.connection,
        roleModel: this.roleModel,
        userModel: this.userModel,
        events: this.events,
        logger: this.logger,
        actorId,
        userId,
        ref: {
          roleId: outcome.roleId,
          assignedSlug: newRole,
          previousRoleId: outcome.previousRoleId,
        },
      });

      logSessionRevocation(this.logger, userId, outcome.revoked);
      this.logger.log({
        event: ADMIN_ROLE_CHANGED,
        userId: id,
        role: liveSlug,
        actorId,
      });

      return ApiResponse.success({
        id: outcome.current._id.toString(),
        role: liveSlug,
      });
    } catch (error) {
      rethrowOrUnavailable(error);
    }
  }

  /**
   * Soft delete a user.
   */
  async deleteUser(id: string, actorId: string): Promise<void> {
    const userId = new Types.ObjectId(id);
    const existing = await this.userModel.findById(id).exec();

    if (!existing || existing.isDeleted) {
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

    try {
      const revoked = await withMajorityTransaction(
        this.connection,
        async (session) => {
          const current = await loadAuthorizedUser(
            this.userModel,
            this.accessService,
            session,
            id,
            actorId,
            'Cannot delete user with higher or equal role',
          );

          current.isDeleted = true;
          current.deletedAt = new Date();
          await current.save({ session });
          return this.sessionService.invalidateAllSessions(userId, session, {
            actorId,
            reasonCode: REVOKED_REASON.ADMIN_FORCED,
          });
        },
      );

      logSessionRevocation(this.logger, userId, revoked);
      this.logger.log(`User ${id} deleted by ${actorId}`);
    } catch (error) {
      rethrowOrUnavailable(error);
    }
  }
}
