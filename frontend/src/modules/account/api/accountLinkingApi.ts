import { baseApi } from '@/store/api/baseApi';
import type { OAuthProvider } from '@/modules/oauth';
import type { LinkedProvidersResponse, SetPrimaryProviderRequest, AccountUser } from '../types';

/**
 * Account Linking API slice
 * Manages linking/unlinking OAuth providers to user accounts
 */
export const accountLinkingApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * Get all linked providers for current user
     */
    getLinkedProviders: builder.query<LinkedProvidersResponse, void>({
      query: () => ({
        url: '/api/user/linked-providers',
        method: 'GET',
      }),
      transformResponse: (response: { success: boolean; data: LinkedProvidersResponse }) =>
        response.data,
      providesTags: ['LinkedProviders'],
    }),

    /**
     * Unlink an OAuth provider from current account
     */
    unlinkProvider: builder.mutation<AccountUser, OAuthProvider>({
      query: (provider) => ({
        url: `/api/user/unlink-provider/${provider}`,
        method: 'DELETE',
      }),
      transformResponse: (response: { success: boolean; data: AccountUser }) => response.data,
      invalidatesTags: ['Auth', 'User', 'LinkedProviders'],
    }),

    /**
     * Set primary provider for profile synchronization
     */
    setPrimaryProvider: builder.mutation<AccountUser, SetPrimaryProviderRequest>({
      query: (data) => ({
        url: '/api/user/set-primary-provider',
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: { success: boolean; data: AccountUser }) => response.data,
      invalidatesTags: ['Auth', 'User', 'LinkedProviders'],
    }),
  }),
});

export const {
  useGetLinkedProvidersQuery,
  useUnlinkProviderMutation,
  useSetPrimaryProviderMutation,
} = accountLinkingApi;
