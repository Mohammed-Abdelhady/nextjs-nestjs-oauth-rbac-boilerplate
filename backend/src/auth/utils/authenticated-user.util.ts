import { Model } from 'mongoose';
import { UserDocument } from '../../user/schemas/user.schema';
import { RoleDocument } from '../../role/schemas/role.schema';
import { getEffectivePermissions } from './permissions.util';

/** Account summary every sign-in route returns alongside the session cookie. */
export interface AuthenticatedUserSummary {
  id: string;
  email: string;
  name: string;
  role: string;
  authProvider: string;
  isVerified: boolean;
  permissions: string[];
}

/**
 * Build the summary of a signed-in account, permissions included.
 *
 * @param user - Account the session belongs to
 * @param roleModel - Role model used to resolve role permissions
 */
export async function toAuthenticatedUser(
  user: UserDocument,
  roleModel: Model<RoleDocument>,
): Promise<AuthenticatedUserSummary> {
  const permissions = await getEffectivePermissions(user, roleModel);

  return {
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    role: user.role,
    authProvider: user.authProvider,
    isVerified: user.isVerified,
    permissions,
  };
}
