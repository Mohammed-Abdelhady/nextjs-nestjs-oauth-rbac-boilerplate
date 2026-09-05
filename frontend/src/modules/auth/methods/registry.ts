import { magicLinkMethod } from '@/modules/auth/methods/magic-link'; // feature:magic-link
import { passwordMethod } from '@/modules/auth/methods/password';
import { passkeysMethod } from '@/modules/passkeys'; // feature:passkeys
import type { AuthMethods } from '../types/auth.types';
import type { AuthMethodEntry } from './types';

/**
 * The sign-in forms this project ships, keyed by method id.
 *
 * Each entry is imported through its own module directory rather than by file,
 * so removing a method from a generated project is a matter of deleting that
 * directory and the lines here that carry its `feature:` marker. Nothing
 * outside a method's directory names its components.
 */
const ENTRIES: readonly AuthMethodEntry[] = [
  passwordMethod,
  passkeysMethod, // feature:passkeys
  magicLinkMethod, // feature:magic-link
];

/** The forms to render, in page order, for what the backend reports. */
export function enabledAuthMethods(methods: AuthMethods): AuthMethodEntry[] {
  return ENTRIES.filter((entry) => entry.isEnabled(methods)).sort(
    (left, right) => left.order - right.order,
  );
}
