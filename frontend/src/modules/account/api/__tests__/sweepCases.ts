import { accountLinkingApi } from '../accountLinkingApi';
import { profileSyncApi } from '../profileSyncApi';
import type { TestStore } from '@/tests/serverRejectionHarness';
import type { MutationCase } from '@/store/api/__tests__/mutationSweepBase';
import { GET_PROFILE, PROFILE, readProfile } from '@/store/api/__tests__/mutationSweepBase';

const GET_LINKED = 'GET /api/user/linked-providers';
const GET_SYNC_STATUS = 'GET /api/user/sync-status';
const readLinked = (store: TestStore) =>
  store.dispatch(accountLinkingApi.endpoints.getLinkedProviders.initiate());
const readSyncStatus = (store: TestStore) =>
  store.dispatch(profileSyncApi.endpoints.getSyncStatus.initiate());

/** What the suite's own reads answer; merged into the shared runner. */
export const extraReads: Record<string, unknown> = {
  '/api/user/linked-providers': { providers: ['email'], primaryProvider: 'email' },
  '/api/user/sync-status': { primaryProvider: 'email', lastSyncedAt: null },
};

/** Account mutations that do not invalidate on a 4xx. */
export const CONVERTED: MutationCase[] = [
  {
    name: 'unlinkProvider',
    reads: [readLinked, readProfile],
    write: (store) => store.dispatch(accountLinkingApi.endpoints.unlinkProvider.initiate('github')),
    accepted: PROFILE,
    requests: [GET_LINKED, GET_PROFILE, 'DELETE /api/user/unlink-provider/github'],
    refetched: [GET_LINKED, GET_PROFILE],
  },
  {
    name: 'setPrimaryProvider',
    reads: [readLinked, readProfile],
    write: (store) =>
      store.dispatch(
        accountLinkingApi.endpoints.setPrimaryProvider.initiate({ provider: 'github' }),
      ),
    accepted: PROFILE,
    requests: [GET_LINKED, GET_PROFILE, 'POST /api/user/set-primary-provider'],
    refetched: [GET_LINKED, GET_PROFILE],
  },
  {
    name: 'initiateProfileSync',
    reads: [readSyncStatus, readProfile],
    write: (store) => store.dispatch(profileSyncApi.endpoints.initiateProfileSync.initiate()),
    accepted: { requiresOAuth: true, provider: 'github', message: 'Re-authenticate' },
    requests: [GET_SYNC_STATUS, GET_PROFILE, 'POST /api/user/sync-profile'],
    refetched: [GET_SYNC_STATUS, GET_PROFILE],
  },
];
