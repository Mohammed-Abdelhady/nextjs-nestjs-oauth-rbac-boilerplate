import { AUTH_METHOD_ID } from '@/modules/auth/constants/authMethods';
import type { AuthMethodEntry } from '@/modules/auth/methods/types';
import { PasskeySignInButton } from '../components/PasskeySignInButton';

/**
 * Registry entry for signing in with a passkey.
 *
 * It sorts above the magic link and below the password, so a deployment
 * without passwords opens on the passkey button, and one with passwords keeps
 * the field people expect at the top.
 */
export const passkeysMethod: AuthMethodEntry = {
  id: AUTH_METHOD_ID.PASSKEYS,
  order: 15,
  isEnabled: (methods) => methods.passkeys,
  Form: PasskeySignInButton,
};
