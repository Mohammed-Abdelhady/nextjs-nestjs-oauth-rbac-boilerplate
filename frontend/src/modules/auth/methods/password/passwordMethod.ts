import { AUTH_METHOD_ID } from '@/modules/auth/constants/authMethods';
import type { AuthMethodEntry } from '../types';
import { PasswordSignInForm } from './PasswordSignInForm';

/** Registry entry for email and password sign-in. */
export const passwordMethod: AuthMethodEntry = {
  id: AUTH_METHOD_ID.PASSWORD,
  order: 10,
  isEnabled: (methods) => methods.password,
  Form: PasswordSignInForm,
};
