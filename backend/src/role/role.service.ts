import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery } from 'mongoose';
import { Role, RoleDocument } from './schemas/role.schema';
import { User, UserDocument } from '../user/schemas/user.schema';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { ListRolesQueryDto } from './dto/list-roles-query.dto';
import {
  RoleResponseDto,
  RoleListData,
  RoleUpdateResponseDto,
} from './dto/role-response.dto';
import { UserRole } from '../user/enums/user-role.enum';
import { WILDCARD_PERMISSION } from '../common/constants/permissions';
import { CUSTOM_ROLE_LEVEL } from '../common/utils/role-hierarchy';
import {
  assertValidPermissions,
  generateSlug,
  resolveRoleLevel,
} from './utils/role.util';

@Injectable()
export class RoleService {
  private readonly logger = new Logger(RoleService.name);

  constructor(
    @InjectModel(Role.name) private readonly roleModel: Model<RoleDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  /**
   * Create a new role with validation
   */
  async create(dto: CreateRoleDto): Promise<RoleResponseDto> {
    const slug = generateSlug(dto.name);

    const existing = await this.roleModel.findOne({ slug });
    if (existing) {
      throw new ConflictException(
        `Role with name "${dto.name}" already exists`,
      );
    }

    assertValidPermissions(dto.permissions);

    const role = new this.roleModel({
      name: dto.name,
      slug,
      description: dto.description,
      isSystemRole: false,
      isProtected: false,
      level: CUSTOM_ROLE_LEVEL,
      permissions: dto.permissions,
    });

    await role.save();

    return this.mapToResponseDto(role);
  }

  /**
   * List all roles with pagination and search
   */
  async findAll(query: ListRolesQueryDto): Promise<RoleListData> {
    const { page = 1, limit = 10, search } = query;
    const skip = (page - 1) * limit;

    // Build filter
    const filter: FilterQuery<RoleDocument> = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { slug: { $regex: search, $options: 'i' } },
      ];
    }

    // Execute queries in parallel
    const [roles, total] = await Promise.all([
      this.roleModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.roleModel.countDocuments(filter),
    ]);

    const pages = Math.ceil(total / limit);

    return {
      roles: roles.map((role) => this.mapToResponseDto(role)),
      total,
      page,
      pages,
    };
  }

  /**
   * Get a single role by ID or slug
   */
  async findOne(idOrSlug: string): Promise<RoleResponseDto> {
    const role = await this.findRoleByIdOrSlug(idOrSlug);
    return this.mapToResponseDto(role);
  }

  /**
   * Update an existing role.
   * System roles keep their slug. Renaming a custom role moves every user
   * assigned to the old slug onto the new one.
   */
  async update(
    idOrSlug: string,
    dto: UpdateRoleDto,
  ): Promise<RoleUpdateResponseDto> {
    const role = await this.findRoleByIdOrSlug(idOrSlug);
    const previousSlug = role.slug;
    const nextSlug = dto.name ? generateSlug(dto.name) : previousSlug;

    if (role.isSystemRole && nextSlug !== previousSlug) {
      throw new ForbiddenException(
        `System role "${previousSlug}" cannot be renamed to a different slug`,
      );
    }

    if (dto.permissions) {
      assertValidPermissions(dto.permissions);
      this.assertAdminKeepsWildcard(previousSlug, dto.permissions);
    }

    if (dto.name && dto.name !== role.name) {
      await this.assertSlugAvailable(nextSlug, role);
      role.name = dto.name;
      role.slug = nextSlug;
    }

    if (dto.description !== undefined) {
      role.description = dto.description;
    }

    if (dto.permissions) {
      role.permissions = dto.permissions;
    }

    await role.save();

    let usersMoved = 0;
    if (nextSlug !== previousSlug) {
      usersMoved = await this.moveUsers(previousSlug, nextSlug);
    }

    return { ...this.mapToResponseDto(role), usersMoved };
  }

  /**
   * Delete a role with validation
   */
  async delete(idOrSlug: string): Promise<void> {
    const role = await this.findRoleByIdOrSlug(idOrSlug);

    // System and protected roles are permanent
    if (role.isSystemRole || role.isProtected) {
      throw new ForbiddenException(
        `Role "${role.slug}" is protected and cannot be deleted`,
      );
    }

    // Check if any users are assigned this role
    const userCount = await this.userModel.countDocuments({
      role: role.slug,
    });

    if (userCount > 0) {
      throw new BadRequestException(
        `Cannot delete role. ${userCount} user${userCount > 1 ? 's' : ''} assigned. Please reassign users first.`,
      );
    }

    await this.roleModel.deleteOne({ _id: role._id });
  }

  /**
   * Get role by slug (helper method)
   */
  async getRoleBySlug(slug: string): Promise<RoleDocument | null> {
    return this.roleModel.findOne({ slug }).exec();
  }

  /**
   * Check if role is assigned to any users
   */
  async isRoleAssignedToUsers(roleSlug: string): Promise<boolean> {
    const count = await this.userModel.countDocuments({ role: roleSlug });
    return count > 0;
  }

  /**
   * Get user count for a role
   */
  async getUserCount(roleSlug: string): Promise<number> {
    return this.userModel.countDocuments({ role: roleSlug });
  }

  /**
   * Find role by ID or slug (private helper)
   */
  private async findRoleByIdOrSlug(idOrSlug: string): Promise<RoleDocument> {
    let role: RoleDocument | null;

    // Try finding by MongoDB ObjectId first
    if (idOrSlug.match(/^[0-9a-fA-F]{24}$/)) {
      role = await this.roleModel.findById(idOrSlug);
    } else {
      // Otherwise treat as slug
      role = await this.roleModel.findOne({ slug: idOrSlug });
    }

    if (!role) {
      throw new NotFoundException(`Role "${idOrSlug}" not found`);
    }

    return role;
  }

  /**
   * Reject a slug already taken by another role
   */
  private async assertSlugAvailable(
    slug: string,
    role: RoleDocument,
  ): Promise<void> {
    const existing = await this.roleModel.findOne({ slug });

    if (existing && existing._id.toString() !== role._id.toString()) {
      throw new ConflictException(`Role with slug "${slug}" already exists`);
    }
  }

  /**
   * The admin role keeps the wildcard permission, otherwise the last
   * account able to manage the system loses its access
   */
  private assertAdminKeepsWildcard(slug: string, permissions: string[]): void {
    if (slug !== (UserRole.ADMIN as string)) {
      return;
    }

    if (!permissions.includes(WILDCARD_PERMISSION)) {
      throw new ForbiddenException(
        `The "${WILDCARD_PERMISSION}" permission cannot be removed from the admin role`,
      );
    }
  }

  /**
   * Move every user from a renamed slug onto the new one
   */
  private async moveUsers(fromSlug: string, toSlug: string): Promise<number> {
    const result = await this.userModel.updateMany(
      { role: fromSlug },
      { $set: { role: toSlug } },
    );

    this.logger.log(
      `Role renamed from "${fromSlug}" to "${toSlug}", ${result.modifiedCount} user(s) moved`,
    );

    return result.modifiedCount;
  }

  /**
   * Map Role document to response DTO
   */
  private mapToResponseDto(
    role: RoleDocument | (Role & { _id: { toString(): string } }),
  ): RoleResponseDto {
    return {
      id: role._id.toString(),
      name: role.name,
      slug: role.slug,
      description: role.description,
      isSystemRole: role.isSystemRole,
      isProtected: role.isProtected,
      level: resolveRoleLevel(role),
      permissions: role.permissions,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };
  }
}
