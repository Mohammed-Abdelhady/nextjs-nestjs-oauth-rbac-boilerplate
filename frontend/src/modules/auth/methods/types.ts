import type { ComponentType } from 'react';
import type { AuthMethodId } from '../constants/authMethods';
import type { AuthMethods } from '../types/auth.types';

export interface AuthMethodFormProps {
  /** Page to open once the sign-in finishes, or null for the default. */
  redirect: string | null;
  /** True when no other form is on the page, so this one carries the heading. */
  isOnlyMethod: boolean;
}

/**
 * One sign-in method as the login page sees it. The page never names a form
 * directly, which is what lets a generated project drop a method's files
 * without editing the page.
 */
export interface AuthMethodEntry {
  id: AuthMethodId;
  /** Lower sorts first on the sign-in page. */
  order: number;
  isEnabled: (methods: AuthMethods) => boolean;
  Form: ComponentType<AuthMethodFormProps>;
}
