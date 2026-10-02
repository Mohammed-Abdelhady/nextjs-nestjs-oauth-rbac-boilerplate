import { baseApi } from '@/store/api/baseApi';
import { API_PATHS, unwrapAuthMethodsBody } from '@app/sdk';
import type { AuthMethods } from '@app/sdk';

/**
 * Sign-in method discovery.
 *
 * Every auth screen reads this before it renders a form, so a deployment that
 * turned password sign-in off never shows a password field.
 */
export const authMethodsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAuthMethods: builder.query<AuthMethods, void>({
      query: () => ({ url: API_PATHS.auth.methods, method: 'GET' }),
      transformResponse: (response: unknown) => unwrapAuthMethodsBody(response),
      providesTags: ['AuthMethods'],
    }),
  }),
});

export const { useGetAuthMethodsQuery } = authMethodsApi;
