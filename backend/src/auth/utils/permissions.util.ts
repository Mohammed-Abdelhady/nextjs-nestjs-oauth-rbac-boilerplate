import { Model } from 'mongoose';
import { RoleDocument } from '../../role/schemas/role.schema';

/**
 * Compute effective permissions by combining role and direct user permissions.
 */
export async function getEffectivePermissions(
  user: { role?: string; permissions?: string[] },
  roleModel: Model<RoleDocument>,
): Promise<string[]> {
  const rolePermissions: string[] = [];

  if (user.role) {
    const role = await roleModel.findOne({ slug: user.role }).exec();
    if (role?.permissions) {
      rolePermissions.push(...role.permissions);
    }
  }

  const directPermissions = user.permissions || [];
  return [...new Set([...rolePermissions, ...directPermissions])];
}
