import {
  Controller,
  Get,
  Delete,
  Post,
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
import { AdminPermissionsService } from './services/admin-permissions.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ApiResponse } from '../common/dto/api-response.dto';
import { AddPermissionDto } from '../user/dto/add-permission.dto';
import { PERMISSION_PERMISSIONS } from '../common/constants/permissions';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';

/**
 * Admin endpoints for direct permission grants.
 * Grants and revokes need the actor's level to exceed the target's level.
 */
@ApiTags('admin')
@ApiBearerAuth('JWT-auth')
@Controller('admin/users')
@UseGuards(AuthGuard, PermissionGuard)
export class AdminPermissionsController {
  constructor(
    private readonly adminPermissionsService: AdminPermissionsService,
  ) {}

  /**
   * List the permissions granted to a user.
   *
   * @example GET /admin/users/:id/permissions
   */
  @Get(':id/permissions')
  @RequirePermissions(PERMISSION_PERMISSIONS.READ_ALL)
  @ApiOperation({
    summary: 'Get user permissions',
    description:
      'Returns all permissions assigned to a specific user. Only users at ' +
      "or below the actor's role level can be read.",
  })
  @ApiParam({
    name: 'id',
    description: 'User ID',
    example: '507f1f77bcf86cd799439011',
  })
  async getUserPermissions(
    @Param('id', ParseObjectIdPipe) userId: string,
    @CurrentUser('role') actorRole: string,
  ): Promise<
    ApiResponse<{ userId: string; permissions: string[]; role: string }>
  > {
    return this.adminPermissionsService.getUserPermissions(userId, actorRole);
  }

  /**
   * Grant a permission to a user.
   *
   * @example POST /admin/users/:id/permissions
   */
  @Post(':id/permissions')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSION_PERMISSIONS.GRANT_ALL)
  @ApiOperation({
    summary: 'Add permission to user',
    description:
      'Adds a direct permission in the format resource:action[:scope]. ' +
      'The wildcard cannot be granted here. Cannot target the actor itself ' +
      "or a user at or above the actor's role level.",
  })
  @ApiParam({
    name: 'id',
    description: 'User ID',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiBody({ type: AddPermissionDto })
  async addPermission(
    @Param('id', ParseObjectIdPipe) userId: string,
    @Body() dto: AddPermissionDto,
    @CurrentUser('id') actorId: string,
    @CurrentUser('role') actorRole: string,
  ): Promise<ApiResponse<{ userId: string; permissions: string[] }>> {
    return this.adminPermissionsService.addPermission(
      userId,
      dto.permission,
      actorId,
      actorRole,
    );
  }

  /**
   * Revoke a permission from a user.
   *
   * @example DELETE /admin/users/:id/permissions/:permission
   */
  @Delete(':id/permissions/:permission')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSION_PERMISSIONS.REVOKE_ALL)
  @ApiOperation({
    summary: 'Remove permission from user',
    description:
      'Removes a direct permission from a user. Cannot target the actor ' +
      "itself or a user at or above the actor's role level.",
  })
  @ApiParam({
    name: 'id',
    description: 'User ID',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiParam({
    name: 'permission',
    description: 'Permission to remove (URL encoded)',
    example: 'users:read:all',
  })
  async removePermission(
    @Param('id', ParseObjectIdPipe) userId: string,
    @Param('permission') permission: string,
    @CurrentUser('id') actorId: string,
    @CurrentUser('role') actorRole: string,
  ): Promise<ApiResponse<{ userId: string; permissions: string[] }>> {
    return this.adminPermissionsService.removePermission(
      userId,
      decodeURIComponent(permission),
      actorId,
      actorRole,
    );
  }
}
