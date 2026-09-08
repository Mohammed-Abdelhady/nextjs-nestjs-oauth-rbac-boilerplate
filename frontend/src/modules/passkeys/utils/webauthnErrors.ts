import { WEBAUTHN_DOM_ERROR_KEYS, WEBAUTHN_ERROR_KEY, type WebAuthnErrorKey } from '../constants';

/** How far down a cause chain to look before giving up. */
const MAX_CAUSE_DEPTH = 4;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * What to tell the reader about a failed ceremony.
 *
 * The browser raises a DOMException, and @simplewebauthn/browser rethrows it
 * as a WebAuthnError with the original on `cause`, so the chain is walked
 * rather than only the outermost name read. Anything unrecognised reads as a
 * plain failure: these messages are written for developers, not for the person
 * at the keyboard, and none of them should reach the screen as they are.
 */
export function webAuthnErrorKey(error: unknown): WebAuthnErrorKey {
  let current: unknown = error;

  for (let depth = 0; depth < MAX_CAUSE_DEPTH && isRecord(current); depth += 1) {
    const { name, cause } = current;

    if (typeof name === 'string' && name in WEBAUTHN_DOM_ERROR_KEYS) {
      return WEBAUTHN_DOM_ERROR_KEYS[name];
    }

    current = cause;
  }

  return WEBAUTHN_ERROR_KEY.FAILED;
}

/** Where a ceremony outcome reads from, under `auth.passkeys`. */
export function webAuthnMessageKey(errorKey: WebAuthnErrorKey): string {
  return `errors.${errorKey}`;
}
