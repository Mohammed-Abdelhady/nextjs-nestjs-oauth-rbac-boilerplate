import { ErrorCode } from '@app/core';
import type { AbortSignalPort } from '@app/native-auth';
import type { ApiClient, MessageResult, RevokeOtherSessionsResult, Session, User } from '@app/sdk';
import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import { API_FAILURE, API_REDUCER_PATH, API_TAG } from '../constants';
import { isApiFailure, toApiFailure } from '../logic/request-failure';
import type { ApiFailure } from '../types';

/** What every request reads from the store: the client over the engine's transport. */
export interface UiExtra {
  client: ApiClient<AbortSignalPort>;
}

type QueryResult<T> = { data: T } | { error: ApiFailure };

function isUiExtra(extra: unknown): extra is UiExtra {
  return typeof extra === 'object' && extra !== null && 'client' in extra;
}

function uiExtra(extra: unknown): UiExtra {
  if (!isUiExtra(extra)) throw new Error('The store was created without its API client.');
  return extra;
}

async function call<T>(
  extra: unknown,
  request: (client: UiExtra['client']) => Promise<T>,
): Promise<QueryResult<T>> {
  try {
    return { data: await request(uiExtra(extra).client) };
  } catch (error) {
    return { error: toApiFailure(error) };
  }
}

/** The server answers "not found" for a session it has already ended, so the row stays gone. */
export function sessionAlreadyEnded(failure: unknown): boolean {
  return (
    isApiFailure(failure) &&
    failure.kind === API_FAILURE.REFUSED &&
    failure.code === ErrorCode.SESSION_NOT_FOUND
  );
}

function rejectionOf(thrown: unknown): unknown {
  return typeof thrown === 'object' && thrown !== null && 'error' in thrown
    ? thrown.error
    : undefined;
}

export const uiApi = createApi({
  reducerPath: API_REDUCER_PATH,
  baseQuery: fakeBaseQuery<ApiFailure>(),
  tagTypes: [API_TAG.PROFILE, API_TAG.SESSIONS],
  endpoints: (builder) => ({
    getProfile: builder.query<User, void>({
      queryFn: (_argument, { extra }) => call(extra, (client) => client.profile.get()),
      providesTags: [API_TAG.PROFILE],
    }),
    listSessions: builder.query<Session[], void>({
      queryFn: (_argument, { extra }) =>
        call(extra, async (client) => (await client.sessions.list()).sessions),
      providesTags: [API_TAG.SESSIONS],
    }),
    revokeSession: builder.mutation<MessageResult, string>({
      queryFn: (sessionId, { extra }) => call(extra, (client) => client.sessions.revoke(sessionId)),
      async onQueryStarted(sessionId, { dispatch, queryFulfilled }) {
        const removal = dispatch(
          uiApi.util.updateQueryData('listSessions', undefined, (sessions) =>
            sessions.filter((session) => session.id !== sessionId),
          ),
        );
        try {
          await queryFulfilled;
        } catch (thrown) {
          // A change of account resets the cache and aborts this request at
          // once, so the undo below lands on an empty cache, never on the
          // next person's list.
          if (!sessionAlreadyEnded(rejectionOf(thrown))) removal.undo();
        }
      },
      // An answer lost in flight can still have ended the session, so the list
      // is read again whichever way the request went.
      invalidatesTags: [API_TAG.SESSIONS],
    }),
    revokeOtherSessions: builder.mutation<RevokeOtherSessionsResult, void>({
      queryFn: (_argument, { extra }) => call(extra, (client) => client.sessions.revokeOthers()),
      async onQueryStarted(_argument, { dispatch, queryFulfilled }) {
        const removal = dispatch(
          uiApi.util.updateQueryData('listSessions', undefined, (sessions) =>
            sessions.filter((session) => session.isCurrent),
          ),
        );
        try {
          await queryFulfilled;
        } catch {
          removal.undo();
        }
      },
      invalidatesTags: [API_TAG.SESSIONS],
    }),
  }),
});

export const { useGetProfileQuery, useListSessionsQuery } = uiApi;
