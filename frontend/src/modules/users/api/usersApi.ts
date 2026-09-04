import { baseApi } from '@/store/api/baseApi';
import type {
  AdminUser,
  GetUsersParams,
  GetUsersResponse,
  CreateUserRequest,
  UpdateUserRequest,
  UpdateUserRoleRequest,
  UpdateUserStatusRequest,
} from '../types';

/**
 * API response structure from backend
 */
interface ApiUsersResponse {
  data: Array<Omit<AdminUser, '_id'> & { id: string }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Users API slice for managing users (admin)
 */
export const usersApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * Get all users (admin)
     */
    getUsers: builder.query<GetUsersResponse, GetUsersParams>({
      query: (params) => {
        const searchParams = new URLSearchParams();
        if (params.page) searchParams.append('page', params.page.toString());
        if (params.limit) searchParams.append('limit', params.limit.toString());
        if (params.search) searchParams.append('search', params.search);
        if (params.role) searchParams.append('role', params.role);
        if (params.isVerified !== undefined)
          searchParams.append('isVerified', params.isVerified.toString());

        const queryString = searchParams.toString();
        return `/api/admin/users${queryString ? `?${queryString}` : ''}`;
      },
      transformResponse: (response: { success: boolean; data: ApiUsersResponse }) => {
        const { data, pagination } = response.data;
        const totalPages =
          pagination.totalPages ??
          Math.max(1, Math.ceil(pagination.total / (pagination.limit || 20)));
        return {
          users: data.map((user) => ({
            ...user,
            _id: user.id,
          })),
          total: pagination.total,
          page: pagination.page,
          limit: pagination.limit,
          totalPages,
        };
      },
      providesTags: (result) =>
        result && result.users
          ? [
              ...result.users.map(({ _id }) => ({ type: 'User' as const, id: _id })),
              { type: 'User', id: 'LIST' },
            ]
          : [{ type: 'User', id: 'LIST' }],
    }),

    /**
     * Create new user (admin)
     */
    createUser: builder.mutation<AdminUser, CreateUserRequest>({
      query: (data) => ({
        url: '/api/admin/users',
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: {
        success: boolean;
        data: Omit<AdminUser, '_id'> & { id: string };
        message: string;
      }) => {
        const { id, ...rest } = response.data;
        return { ...rest, _id: id };
      },
      invalidatesTags: [{ type: 'User', id: 'LIST' }],
    }),

    /**
     * Get user by ID (admin)
     */
    getUserById: builder.query<AdminUser, string>({
      query: (userId) => `/api/admin/users/${userId}`,
      transformResponse: (response: {
        success: boolean;
        data: Omit<AdminUser, '_id'> & { id: string };
      }) => {
        const { id, ...rest } = response.data;
        return { ...rest, _id: id };
      },
      providesTags: (result, error, userId) => [{ type: 'User', id: userId }],
    }),

    /**
     * Update user information (admin)
     */
    updateUser: builder.mutation<AdminUser, UpdateUserRequest>({
      query: ({ userId, name, email }) => ({
        url: `/api/admin/users/${userId}`,
        method: 'PATCH',
        body: { name, email },
      }),
      transformResponse: (response: {
        success: boolean;
        data: Omit<AdminUser, '_id'> & { id: string };
        message: string;
      }) => {
        const { id, ...rest } = response.data;
        return { ...rest, _id: id };
      },
      invalidatesTags: (result, error, { userId }) => [
        { type: 'User', id: userId },
        { type: 'User', id: 'LIST' },
      ],
    }),

    /**
     * Update user status (admin)
     */
    updateUserStatus: builder.mutation<
      { id: string; isDeleted: boolean; deletedAt?: string },
      UpdateUserStatusRequest
    >({
      query: ({ userId, isActive }) => ({
        url: `/api/admin/users/${userId}/status`,
        method: 'PATCH',
        body: { isActive },
      }),
      transformResponse: (response: {
        success: boolean;
        data: { id: string; isDeleted: boolean; deletedAt?: string };
        message: string;
      }) => response.data,
      invalidatesTags: (result, error, { userId }) => [
        { type: 'User', id: userId },
        { type: 'User', id: 'LIST' },
      ],
    }),

    /**
     * Update user role (admin)
     */
    updateUserRole: builder.mutation<AdminUser, UpdateUserRoleRequest>({
      query: ({ userId, role }) => ({
        url: `/api/admin/users/${userId}/role`,
        method: 'PATCH',
        body: { role },
      }),
      transformResponse: (response: {
        success: boolean;
        data: Omit<AdminUser, '_id'> & { id: string };
        message: string;
      }) => {
        const { id, ...rest } = response.data;
        return { ...rest, _id: id };
      },
      invalidatesTags: (result, error, { userId }) => [
        { type: 'User', id: userId },
        { type: 'User', id: 'LIST' },
      ],
    }),

    /**
     * Delete user (admin)
     */
    deleteUser: builder.mutation<{ message: string }, string>({
      query: (userId) => ({
        url: `/api/admin/users/${userId}`,
        method: 'DELETE',
      }),
      transformResponse: (response: { success: boolean; data: { message: string } }) =>
        response.data,
      invalidatesTags: (result, error, userId) => [
        { type: 'User', id: userId },
        { type: 'User', id: 'LIST' },
      ],
    }),
  }),
});

export const {
  useGetUsersQuery,
  useGetUserByIdQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useUpdateUserStatusMutation,
  useUpdateUserRoleMutation,
  useDeleteUserMutation,
} = usersApi;
