import { Injectable, Logger } from '@nestjs/common';
import { UserPermissionsService } from '../../user/services/user-permissions.service';
import { ApiResponse } from '../../common/dto/api-response.dto';
import { AdminUserAccessService } from './admin-user-access.service';

interface UserPermissionsData {
  userId: string;
  permissions: string[];
}

interface UserPermissionsWithRole extends UserPermissionsData {
  role: string;
}

/**
 * Direct permission grants handled from the admin area.
 * Reading a user's permissions follows the non-strict hierarchy comparison,
 * granting and revoking follow the strict one.
 */
@Injectable()
export class AdminPermissionsService {
  private readonly logger = new Logger(AdminPermissionsService.name);

  constructor(
    private readonly accessService: AdminUserAccessService,
    private readonly userPermissionsService: UserPermissionsService,
  ) {}

  /**
   * Read the permissions of a user the actor is allowed to see.
   */
  async getUserPermissions(
    userId: string,
    actorRole: string,
  ): Promise<ApiResponse<UserPermissionsWithRole>> {
    const target = await this.accessService.loadActiveUser(userId);
    await this.accessService.assertCanView(actorRole, target.role);

    return this.userPermissionsService.getUserPermissions(userId);
  }

  /**
   * Grant a direct permission to a user below the actor's level.
   */
  async addPermission(
    userId: string,
    permission: string,
    actorId: string,
    actorRole: string,
  ): Promise<ApiResponse<UserPermissionsData>> {
    await this.assertCanGrant(userId, actorId, actorRole);
    this.logger.log(`Granting ${permission} on user ${userId} by ${actorId}`);

    return this.userPermissionsService.addPermission(userId, permission);
  }

  /**
   * Revoke a direct permission from a user below the actor's level.
   */
  async removePermission(
    userId: string,
    permission: string,
    actorId: string,
    actorRole: string,
  ): Promise<ApiResponse<UserPermissionsData>> {
    await this.assertCanGrant(userId, actorId, actorRole);
    this.logger.log(`Revoking ${permission} on user ${userId} by ${actorId}`);

    return this.userPermissionsService.removePermission(userId, permission);
  }

  private async assertCanGrant(
    userId: string,
    actorId: string,
    actorRole: string,
  ): Promise<void> {
    const target = await this.accessService.loadActiveUser(userId);

    this.accessService.assertNotSelf(
      userId,
      actorId,
      'Cannot change your own permissions',
    );
    await this.accessService.assertCanModify(
      actorRole,
      target.role,
      'Cannot change permissions of a user with higher or equal role',
    );
  }
}
