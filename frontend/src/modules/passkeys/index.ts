// Sign-in registry entry
export { passkeysMethod } from './methods/passkeysMethod';

// Components
export { PasskeysCard } from './components/PasskeysCard';
export { PasskeyChallengeButton } from './components/PasskeyChallengeButton';
export { PasskeySignInButton } from './components/PasskeySignInButton';

// Hooks
export { usePasskeySupport, usePasskeySignIn, useRegisterPasskey } from './hooks';

// API hooks
export {
  passkeysApi,
  useGetPasskeysQuery,
  useCreatePasskeyOptionsMutation,
  useRegisterPasskeyMutation,
  useRenamePasskeyMutation,
  useDeletePasskeyMutation,
  useCreatePasskeyLoginOptionsMutation,
  useSignInWithPasskeyMutation,
  useAnswerTwoFactorWithPasskeyMutation,
} from './api';

// Constants
export { PASSKEY_PATHS, PASSKEY_NAME_MAX_LENGTH, passkeyPath } from './constants';

// Types
export {
  PASSKEY_NAME_MODE,
  PASSKEY_SUPPORT,
  type PasskeyNameMode,
  type PasskeySummary,
  type PasskeySupport,
} from './types';
