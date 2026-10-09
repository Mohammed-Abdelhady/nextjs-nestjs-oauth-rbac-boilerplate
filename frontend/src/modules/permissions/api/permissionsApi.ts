import { baseApi } from '@/store/api/baseApi';
import { invalidateOnSuccess } from '@/store/api/invalidateOnSuccess';

/**
 * User permissions response
 */
export interface UserPermissionsResponse {
  userId: string;
  permissions: string[];
  role: string;
}

/** Argument of the add and remove permission mutations. */
export interface UserPermissionArgs {
  userId: string;
  permission: string;
}

/**
 * Add permission request
 */
export interface AddPermissionRequest {
  permission: string;
}

/**
 * Permissions API slice for managing user permissions
 */
export const permissionsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * Get user permissions
     */
    getUserPermissions: builder.query<UserPermissionsResponse, string>({
      query: (userId) => `/api/admin/users/${userId}/permissions`,
      transformResponse: (response: { success: boolean; data: UserPermissionsResponse }) =>
        response.data,
      providesTags: (result, error, userId) => [{ type: 'Permissions', id: userId }],
    }),

    /**
     * Add permission to user
     */
    addPermission: builder.mutation<UserPermissionsResponse, UserPermissionArgs>({
      query: ({ userId, permission }) => ({
        url: `/api/admin/users/${userId}/permissions`,
        method: 'POST',
        body: { permission },
      }),
      transformResponse: (response: {
        success: boolean;
        data: UserPermissionsResponse;
        message: string;
      }) => response.data,
      invalidatesTags: invalidateOnSuccess(({ userId }: UserPermissionArgs) => [
        { type: 'Permissions', id: userId },
        'User',
      ]),
    }),

    /**
     * Remove permission from user
     */
    removePermission: builder.mutation<UserPermissionsResponse, UserPermissionArgs>({
      query: ({ userId, permission }) => ({
        url: `/api/admin/users/${userId}/permissions/${encodeURIComponent(permission)}`,
        method: 'DELETE',
      }),
      transformResponse: (response: {
        success: boolean;
        data: UserPermissionsResponse;
        message: string;
      }) => response.data,
      invalidatesTags: invalidateOnSuccess(({ userId }: UserPermissionArgs) => [
        { type: 'Permissions', id: userId },
        'User',
      ]),
    }),
  }),
});

// Export hooks
export const { useGetUserPermissionsQuery, useAddPermissionMutation, useRemovePermissionMutation } =
  permissionsApi;
