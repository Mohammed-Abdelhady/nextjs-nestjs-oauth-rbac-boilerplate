import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Role, RoleDocument } from '../../role/schemas/role.schema';
import { ROLE_HIERARCHY } from '../../common/utils/role-hierarchy';
import { DEFAULT_ROLE_PERMISSIONS } from '../../common/constants/permissions';

/**
 * Seed service for default system roles.
 * Creates USER, SUPPORT, MANAGER, and ADMIN roles with appropriate permissions.
 */
@Injectable()
export class RoleSeedService {
  constructor(
    @InjectModel(Role.name) private readonly roleModel: Model<RoleDocument>,
  ) {}

  /**
   * Seed default roles if they don't exist
   */
  async seed(): Promise<void> {
    const defaultRoles = [
      {
        name: 'User',
        slug: 'user',
        description: 'Default role for all customers',
        isSystemRole: true,
        isProtected: true,
        level: ROLE_HIERARCHY.user,
        permissions: [...DEFAULT_ROLE_PERMISSIONS.user],
      },
      {
        name: 'Support',
        slug: 'support',
        description: 'Customer support staff',
        isSystemRole: true,
        isProtected: true,
        level: ROLE_HIERARCHY.support,
        permissions: [...DEFAULT_ROLE_PERMISSIONS.support],
      },
      {
        name: 'Manager',
        slug: 'manager',
        description: 'Management staff',
        isSystemRole: true,
        isProtected: true,
        level: ROLE_HIERARCHY.manager,
        permissions: [...DEFAULT_ROLE_PERMISSIONS.manager],
      },
      {
        name: 'Admin',
        slug: 'admin',
        description: 'System administrator with full access',
        isSystemRole: true,
        isProtected: true,
        level: ROLE_HIERARCHY.admin,
        permissions: [...DEFAULT_ROLE_PERMISSIONS.admin],
      },
    ];

    for (const roleData of defaultRoles) {
      const exists = await this.roleModel.findOne({ slug: roleData.slug });

      if (!exists) {
        await this.roleModel.create(roleData);
        console.log(`Created default role: ${roleData.name}`);
        continue;
      }

      // Existing installs predate the level field and the protection flags
      await this.roleModel.updateOne(
        { slug: roleData.slug },
        {
          $set: {
            isSystemRole: roleData.isSystemRole,
            isProtected: roleData.isProtected,
            level: roleData.level,
          },
        },
      );
      console.log(`Role "${roleData.name}" exists, flags refreshed`);
    }

    console.log('Role seeding completed');
  }

  /**
   * Update existing roles' permissions (for migrations)
   */
  async updateRolePermissions(): Promise<void> {
    const updates = [
      {
        slug: 'user',
        permissions: [...DEFAULT_ROLE_PERMISSIONS.user],
      },
      {
        slug: 'support',
        permissions: [...DEFAULT_ROLE_PERMISSIONS.support],
      },
      {
        slug: 'manager',
        permissions: [...DEFAULT_ROLE_PERMISSIONS.manager],
      },
      {
        slug: 'admin',
        permissions: [...DEFAULT_ROLE_PERMISSIONS.admin],
      },
    ];

    for (const update of updates) {
      await this.roleModel.updateOne(
        { slug: update.slug },
        { $set: { permissions: update.permissions } },
      );
      console.log(`Updated permissions for role: ${update.slug}`);
    }

    console.log('Role permission updates completed');
  }
}
