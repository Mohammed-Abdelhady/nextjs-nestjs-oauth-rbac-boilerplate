import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Role, RoleDocument } from '../schemas/role.schema';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/enums/error-code.enum';
import { UNKNOWN_ROLE_LEVEL } from '../../common/utils/role-hierarchy';
import { RoleLevelSource, resolveRoleLevel } from '../utils/role.util';

type RoleLevelProjection = RoleLevelSource;

/**
 * Reads role hierarchy levels from the roles collection.
 * The hardcoded map in common/utils/role-hierarchy only seeds the system roles
 * and serves as a fallback for documents written before the level field existed.
 */
@Injectable()
export class RoleHierarchyService {
  constructor(
    @InjectModel(Role.name) private readonly roleModel: Model<RoleDocument>,
  ) {}

  /**
   * Level of a role slug.
   *
   * @param slug - Role slug to resolve
   * @returns The stored level, or 0 when the slug has no role document
   */
  async getLevel(slug: string): Promise<number> {
    const role = await this.findLevel(slug);
    return role ? resolveRoleLevel(role) : UNKNOWN_ROLE_LEVEL;
  }

  /**
   * Level of a role slug that must exist.
   *
   * @param slug - Role slug to resolve
   * @throws AppException ROLE_NOT_FOUND when no role carries the slug
   */
  async getLevelOrFail(slug: string): Promise<number> {
    const role = await this.findLevel(slug);

    if (!role) {
      throw new AppException(
        ErrorCode.ROLE_NOT_FOUND,
        `Role "${slug}" does not exist`,
        HttpStatus.NOT_FOUND,
      );
    }

    return resolveRoleLevel(role);
  }

  /**
   * Slugs of every role whose level is at or below the given level.
   * Filtering happens in memory because older documents have no level field.
   *
   * @param level - Inclusive upper bound
   */
  async getSlugsAtOrBelow(level: number): Promise<string[]> {
    const roles = await this.roleModel
      .find()
      .select('slug level')
      .lean<RoleLevelProjection[]>()
      .exec();

    return roles
      .filter((role) => resolveRoleLevel(role) <= level)
      .map((role) => role.slug);
  }

  private async findLevel(slug: string): Promise<RoleLevelProjection | null> {
    return this.roleModel
      .findOne({ slug })
      .select('slug level')
      .lean<RoleLevelProjection | null>()
      .exec();
  }
}
