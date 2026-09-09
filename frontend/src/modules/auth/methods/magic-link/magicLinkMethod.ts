import { AUTH_METHOD_ID } from '@/modules/auth/constants/authMethods';
import type { AuthMethodEntry } from '../types';
import { MagicLinkRequestForm } from './MagicLinkRequestForm';

/** Registry entry for passwordless sign-in by mailed link. */
export const magicLinkMethod: AuthMethodEntry = {
  id: AUTH_METHOD_ID.MAGIC_LINK,
  order: 20,
  isEnabled: (methods) => methods.magicLink,
  Form: MagicLinkRequestForm,
};
