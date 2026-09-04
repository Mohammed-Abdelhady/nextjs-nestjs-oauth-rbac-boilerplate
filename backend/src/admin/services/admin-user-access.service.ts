import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../../user/schemas/user.schema';
import { RoleHierarchyService } from '../../role/services/role-hierarchy.service';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/enums/error-code.enum';
import {
  canManageLevel,
  canModifyLevel,
  isValidRoleAssignment,
} from '../../common/utils/role-hierarchy';

/**
 * Lookups and hierarchy checks shared by the admin services.
 * Reads keep the non-strict comparison, mutations use the strict one so peers
 * cannot act on each other.
 */
@Injectable()
export class AdminUserAccessService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly roleHierarchyService: RoleHierarchyService,
  ) {}

  /**
   * Load a user that is present and not soft deleted.
   *
   * @throws AppException USER_NOT_FOUND
   */
  async loadActiveUser(id: string): Promise<UserDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new AppException(
        ErrorCode.INVALID_INPUT,
        'Invalid user ID format',
        HttpStatus.BAD_REQUEST,
      );
    }

    const user = await this.userModel.findById(id).exec();

    if (!user || user.isDeleted) {
      throw new AppException(
        ErrorCode.USER_NOT_FOUND,
        'User not found',
        HttpStatus.NOT_FOUND,
      );
    }

    return user;
  }

  /**
   * Reject an operation an actor aims at its own account.
   *
   * @throws AppException CANNOT_MODIFY_SELF
   */
  assertNotSelf(targetId: string, actorId: string, message: string): void {
    if (targetId === actorId) {
      throw new AppException(
        ErrorCode.CANNOT_MODIFY_SELF,
        message,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Read access: the actor may see its own level and below.
   *
   * @throws AppException CANNOT_MODIFY_HIGHER_ROLE
   */
  async assertCanView(actorRole: string, targetRole: string): Promise<void> {
    const [actorLevel, targetLevel] = await this.resolveLevels(
      actorRole,
      targetRole,
    );

    if (!canManageLevel(actorLevel, targetLevel)) {
      throw new AppException(
        ErrorCode.CANNOT_MODIFY_HIGHER_ROLE,
        'Cannot view user with higher role',
        HttpStatus.FORBIDDEN,
      );
    }
  }

  /**
   * Write access: the actor's level must exceed the target's level.
   *
   * @throws AppException CANNOT_MODIFY_HIGHER_ROLE
   */
  async assertCanModify(
    actorRole: string,
    targetRole: string,
    message = 'Cannot modify user with higher or equal role',
  ): Promise<void> {
    const [actorLevel, targetLevel] = await this.resolveLevels(
      actorRole,
      targetRole,
    );

    if (!canModifyLevel(actorLevel, targetLevel)) {
      throw new AppException(
        ErrorCode.CANNOT_MODIFY_HIGHER_ROLE,
        message,
        HttpStatus.FORBIDDEN,
      );
    }
  }

  /**
   * Check a role slug an actor wants to hand out. The role must exist and sit
   * below the actor's own level. Admin stays out of reach of the API.
   *
   * @throws AppException INVALID_ROLE_ASSIGNMENT, ROLE_NOT_FOUND or
   * CANNOT_MODIFY_HIGHER_ROLE
   */
  async assertCanAssignRole(actorRole: string, newRole: string): Promise<void> {
    if (!isValidRoleAssignment(newRole)) {
      throw new AppException(
        ErrorCode.INVALID_ROLE_ASSIGNMENT,
        'Cannot assign ADMIN role via API',
        HttpStatus.BAD_REQUEST,
      );
    }

    const targetLevel = await this.roleHierarchyService.getLevelOrFail(newRole);
    const actorLevel = await this.getActorLevel(actorRole);

    if (!canModifyLevel(actorLevel, targetLevel)) {
      throw new AppException(
        ErrorCode.CANNOT_MODIFY_HIGHER_ROLE,
        'Cannot assign a role at or above your own level',
        HttpStatus.FORBIDDEN,
      );
    }
  }

  /**
   * Hierarchy level of the acting user's role.
   */
  async getActorLevel(actorRole: string): Promise<number> {
    return this.roleHierarchyService.getLevel(actorRole);
  }

  /**
   * Role slugs an actor may see in listings, custom roles included.
   */
  async getViewableSlugs(actorRole: string): Promise<string[]> {
    const actorLevel = await this.getActorLevel(actorRole);
    return this.roleHierarchyService.getSlugsAtOrBelow(actorLevel);
  }

  private async resolveLevels(
    actorRole: string,
    targetRole: string,
  ): Promise<[number, number]> {
    return Promise.all([
      this.roleHierarchyService.getLevel(actorRole),
      this.roleHierarchyService.getLevel(targetRole),
    ]);
  }
}
