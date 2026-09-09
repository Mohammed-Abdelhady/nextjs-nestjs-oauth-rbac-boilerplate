// Components
export { UpdateProfileCard } from './components';
// feature:oauth-core:start
export {
  LinkedAccounts,
  LinkedAccountCard,
  LinkProviderButton,
  ProfileSyncStatus,
} from './components';

// API hooks
export {
  useGetLinkedProvidersQuery,
  useUnlinkProviderMutation,
  useSetPrimaryProviderMutation,
  useGetSyncStatusQuery,
  useInitiateProfileSyncMutation,
} from './api';
// feature:oauth-core:end

// Types
export type { AccountUser } from './types';
// feature:oauth-core:start
export type {
  LinkedProvidersResponse,
  SetPrimaryProviderRequest,
  ProfileSyncStatus as ProfileSyncStatusType,
  ManualSyncResponse,
} from './types';
// feature:oauth-core:end
