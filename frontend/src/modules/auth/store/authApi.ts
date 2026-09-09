import { baseApi } from '@/store/api/baseApi';
import type {
  User,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  ActivateRequest,
  ActivateResponse,
  ResendActivationRequest,
  ResendActivationResponse,
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  ResetPasswordRequest,
  ResetPasswordResponse,
} from '../types/auth.types';

/**
 * Auth API slice with authentication endpoints
 * Extends the base API with auth-specific operations
 */
export const authApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * Login mutation
     * Authenticates user with email and password
     */
    login: builder.mutation<LoginResponse, LoginRequest>({
      query: (credentials) => ({
        url: '/api/auth/login',
        method: 'POST',
        body: credentials,
      }),
      transformResponse: (response: { success: boolean; data: LoginResponse; message: string }) =>
        response.data,
      invalidatesTags: ['Auth', 'User'],
    }),

    /**
     * Logout mutation
     * Clears user session and auth cookies
     */
    logout: builder.mutation<{ message: string }, void>({
      query: () => ({
        url: '/api/auth/logout',
        method: 'POST',
      }),
      invalidatesTags: [
        'Auth',
        'User',
        'LinkedProviders', // feature:oauth-core
        'ProfileSync', // feature:oauth-core
        'Roles',
        'Permissions',
      ],
    }),

    /**
     * Refresh token mutation
     * Refreshes the auth token using refresh cookie
     */
    refreshToken: builder.mutation<{ token: string }, void>({
      query: () => ({
        url: '/api/auth/refresh',
        method: 'POST',
      }),
      invalidatesTags: ['Auth'],
    }),

    /**
     * Get current user query
     * Fetches the currently authenticated user's data
     */
    getCurrentUser: builder.query<User, void>({
      query: () => '/api/user/profile',
      transformResponse: (response: { success: boolean; data: User }) => response.data,
      providesTags: ['User'],
    }),

    /**
     * Register mutation
     * Creates new user account and sends activation email
     */
    register: builder.mutation<RegisterResponse, RegisterRequest>({
      query: (data) => ({
        url: '/api/auth/register',
        method: 'POST',
        body: data,
      }),
    }),

    /**
     * Activate mutation
     * Verifies email with activation code and logs user in
     */
    activate: builder.mutation<ActivateResponse, ActivateRequest>({
      query: (data) => ({
        url: '/api/auth/activate',
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: {
        success: boolean;
        data: ActivateResponse;
        message: string;
      }) => response.data,
      invalidatesTags: ['Auth', 'User'],
    }),

    /**
     * Resend activation code mutation
     * Sends a new activation code to the user's email
     */
    resendActivation: builder.mutation<ResendActivationResponse, ResendActivationRequest>({
      query: (data) => ({
        url: '/api/auth/resend-activation',
        method: 'POST',
        body: data,
      }),
    }),

    /**
     * Forgot password mutation
     * Sends password reset link to user's email
     */
    forgotPassword: builder.mutation<ForgotPasswordResponse, ForgotPasswordRequest>({
      query: (data) => ({
        url: '/api/auth/forgot-password',
        method: 'POST',
        body: data,
      }),
    }),

    /**
     * Reset password mutation
     * Resets user password with token from email
     */
    resetPassword: builder.mutation<ResetPasswordResponse, ResetPasswordRequest>({
      query: (data) => ({
        url: '/api/auth/reset-password',
        method: 'POST',
        body: data,
      }),
    }),

    /**
     * Change password mutation
     * Changes password for authenticated user
     * Invalidates all other sessions on success
     */
    changePassword: builder.mutation<
      { message: string },
      { currentPassword: string; newPassword: string }
    >({
      query: (data) => ({
        url: '/api/user/password',
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: { success: boolean; data: { message: string } }) =>
        response.data,
      invalidatesTags: ['Sessions'],
    }),

    /**
     * Update profile mutation
     * Updates user profile information (name)
     */
    updateProfile: builder.mutation<User, { name: string }>({
      query: (data) => ({
        url: '/api/user/profile',
        method: 'PATCH',
        body: data,
      }),
      transformResponse: (response: { success: boolean; data: User }) => response.data,
      invalidatesTags: ['User'],
    }),
  }),
});

// Export hooks for usage in components
export const {
  useLoginMutation,
  useLogoutMutation,
  useRefreshTokenMutation,
  useGetCurrentUserQuery,
  useRegisterMutation,
  useActivateMutation,
  useResendActivationMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useChangePasswordMutation,
  useUpdateProfileMutation,
} = authApi;
