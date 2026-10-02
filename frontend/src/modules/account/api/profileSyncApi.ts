import { baseApi } from '@/store/api/baseApi';
import { invalidateOnSuccess } from '@/store/api/invalidateOnSuccess';
import type { ProfileSyncStatus, ManualSyncResponse } from '../types';

/**
 * Profile Sync API
 * RTK Query endpoints for profile synchronization
 */
export const profileSyncApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * Get profile sync status
     */
    getSyncStatus: builder.query<ProfileSyncStatus, void>({
      query: () => '/api/user/sync-status',
      transformResponse: (response: { data: ProfileSyncStatus }) => response.data,
      providesTags: ['ProfileSync'],
    }),

    /**
     * Initiate manual profile sync
     * Returns instructions to re-authenticate with OAuth
     */
    initiateProfileSync: builder.mutation<ManualSyncResponse, void>({
      query: () => ({
        url: '/api/user/sync-profile',
        method: 'POST',
      }),
      transformResponse: (response: { data: ManualSyncResponse }) => response.data,
      invalidatesTags: invalidateOnSuccess(['ProfileSync', 'User']),
    }),
  }),
});

export const { useGetSyncStatusQuery, useInitiateProfileSyncMutation } = profileSyncApi;
