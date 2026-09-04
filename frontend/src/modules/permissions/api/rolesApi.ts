/**
 * Role endpoints moved to the roles module.
 *
 * This file only re-exports them so existing imports keep working; the
 * endpoints are injected once, in `@/modules/roles/api/rolesApi`.
 *
 * @deprecated Import from `@/modules/roles` instead.
 */
export * from '@/modules/roles/api/rolesApi';
export type {
  Role,
  CreateRoleRequest,
  UpdateRoleRequest,
  ListRolesQuery,
  ListRolesResponse,
} from '@/modules/roles/types';
