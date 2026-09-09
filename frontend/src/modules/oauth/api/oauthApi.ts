import { baseApi } from '@/store/api/baseApi';
import { OAUTH_PROVIDERS_PATH } from '../constants';
import type { OAuthProviderSummary, OAuthProvidersResponse } from '../types';

/**
 * OAuth API slice.
 *
 * Sign-in itself runs as a browser navigation through the backend start and
 * callback routes, so the only endpoint left here is provider discovery.
 */
export const oauthApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * Lists the providers that have credentials configured on the backend.
     */
    getEnabledProviders: builder.query<OAuthProviderSummary[], void>({
      query: () => ({
        url: OAUTH_PROVIDERS_PATH,
        method: 'GET',
      }),
      transformResponse: (response: { success: boolean; data: OAuthProvidersResponse }) =>
        response.data.providers,
    }),
  }),
});

export const { useGetEnabledProvidersQuery } = oauthApi;
