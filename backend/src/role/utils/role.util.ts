import { BadRequestException } from '@nestjs/common';
import { PERMISSION_REGEX } from '../../common/constants/permissions';
import {
  CUSTOM_ROLE_LEVEL,
  ROLE_HIERARCHY,
} from '../../common/utils/role-hierarchy';
import { RoleResponseDto } from '../dto/role-response.dto';
import { Role, RoleDocument } from '../schemas/role.schema';

/**
 * Role fields needed to work out a hierarchy level.
 */
export interface RoleLevelSource {
  slug: string;
  level?: number;
}

/**
 * Turn a role display name into a URL-safe slug.
 *
 * @param name - Role display name
 * @returns Lowercase hyphenated slug
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/**
 * Reject permissions that do not match resource:action[:scope] or the wildcard.
 *
 * @param permissions - Permission strings to check
 * @throws BadRequestException on the first malformed entry
 */
export function assertValidPermissions(permissions: string[]): void {
  for (const permission of permissions) {
    if (!PERMISSION_REGEX.test(permission)) {
      throw new BadRequestException(
        `Invalid permission format: "${permission}". Must be resource:action[:scope] or wildcard "*"`,
      );
    }
  }
}

/**
 * Hierarchy level of a role document.
 * Falls back to the seed map for documents written before the level field,
 * then to the level shared by custom roles.
 *
 * @param role - Role slug and stored level
 */
export function resolveRoleLevel(role: RoleLevelSource): number {
  return role.level ?? ROLE_HIERARCHY[role.slug] ?? CUSTOM_ROLE_LEVEL;
}

/**
 * Map Role document to response DTO.
 *
 * @param role - Stored role document
 * @returns Serialized role response DTO
 */
export function mapRoleToResponseDto(
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
