import { baseApi } from '@/store/api/baseApi';
import { API_PATHS, unwrapObjectBody, unwrapSessionListBody } from '@app/sdk';
import type { MessageResult, RevokeOtherSessionsResult, Session } from '@app/sdk';

/**
 * Sessions API slice with session management endpoints
 */
export const sessionsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * Get all active sessions for current user
     */
    getSessions: builder.query<Session[], void>({
      query: () => API_PATHS.user.sessions,
      transformResponse: (response: unknown) => unwrapSessionListBody(response).sessions,
      providesTags: ['Sessions'],
    }),

    /**
     * Delete specific session by ID
     */
    deleteSession: builder.mutation<MessageResult, string>({
      query: (sessionId) => ({
        url: API_PATHS.user.session(sessionId),
        method: 'DELETE',
      }),
      transformResponse: (response: unknown) => unwrapObjectBody<MessageResult>(response),
      // Revocation: a 404 "already revoked" answers after the server did
      // revoke, and an answer can be lost in flight, so the list must be
      // refetched whichever way the request fails.
      invalidatesTags: ['Sessions'],
    }),

    /**
     * Revoke all sessions except current one
     */
    revokeAllOtherSessions: builder.mutation<RevokeOtherSessionsResult, void>({
      query: () => ({
        url: API_PATHS.user.revokeOtherSessions,
        method: 'POST',
      }),
      transformResponse: (response: unknown) =>
        unwrapObjectBody<RevokeOtherSessionsResult>(response),
      // Revocation: a lost answer can still have ended the other sessions, so
      // the list must refetch rather than be trusted after a failure.
      invalidatesTags: ['Sessions'],
    }),
  }),
});

// Export hooks
export const { useGetSessionsQuery, useDeleteSessionMutation, useRevokeAllOtherSessionsMutation } =
  sessionsApi;
