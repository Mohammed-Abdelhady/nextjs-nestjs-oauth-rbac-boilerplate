import { baseApi } from '@/store/api/baseApi';
import { AUTH_METHODS_PATH } from '../constants/authMethods';
import type { AuthMethods, AuthMethodsResponse } from '../types/auth.types';

/**
 * Sign-in method discovery.
 *
 * Every auth screen reads this before it renders a form, so a deployment that
 * turned password sign-in off never shows a password field.
 */
export const authMethodsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAuthMethods: builder.query<AuthMethods, void>({
      query: () => ({ url: AUTH_METHODS_PATH, method: 'GET' }),
      transformResponse: (response: {
        success: boolean;
        data: AuthMethodsResponse;
      }): AuthMethods => ({
        ...response.data.methods,
        passkeys: response.data.methods.passkeys ?? false,
      }),
      providesTags: ['AuthMethods'],
    }),
  }),
});

export const { useGetAuthMethodsQuery } = authMethodsApi;
