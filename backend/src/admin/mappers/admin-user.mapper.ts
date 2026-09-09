import { UserDocument } from '../../user/schemas/user.schema';
import { AdminUserDto } from '../dto/admin-user-response.dto';

/**
 * Map a user document to the shape returned by the admin endpoints.
 *
 * @param user - Hydrated user document
 */
export function mapToAdminUserDto(user: UserDocument): AdminUserDto {
  return {
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    role: user.role,
    permissions: user.permissions || [],
    authProvider: user.authProvider,
    isVerified: user.isVerified,
    isDeleted: user.isDeleted,
    avatarUrl: user.avatarUrl,
    linkedProviders: user.linkedProviders,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
