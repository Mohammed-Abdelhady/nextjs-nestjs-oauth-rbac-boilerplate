/**
 * Admin user endpoints moved to the users module.
 *
 * This file only re-exports them so existing imports keep working; the
 * endpoints are injected once, in `@/modules/users/api/usersApi`.
 *
 * @deprecated Import from `@/modules/users` instead.
 */
export * from '@/modules/users/api/usersApi';
export type {
  AdminUser as User,
  GetUsersParams,
  GetUsersResponse,
  CreateUserRequest,
  UpdateUserRequest,
  UpdateUserRoleRequest,
  UpdateUserStatusRequest,
} from '@/modules/users/types';
