import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/browser';
import type { WebAuthnErrorKey } from '../constants';
import { webAuthnErrorKey } from './webauthnErrors';

export type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
};

export { webAuthnErrorKey, webAuthnMessageKey } from './webauthnErrors';

/**
 * What a ceremony gives back. A failure carries the key to translate rather
 * than the DOMException, whose message is written for developers and is the
 * one thing that must not reach the screen.
 */
export type CeremonyResult<T> = { ok: true; value: T } | { ok: false; errorKey: WebAuthnErrorKey };

/**
 * The only file that talks to @simplewebauthn/browser.
 *
 * The library is loaded on demand rather than imported at the top, so WebAuthn
 * code stays out of the first load of every page that reaches a passkey
 * component, and a component stays importable in a test that never runs a
 * ceremony.
 */
function loadLibrary(): Promise<typeof import('@simplewebauthn/browser')> {
  return import('@simplewebauthn/browser');
}

async function runCeremony<T>(ceremony: () => Promise<T>): Promise<CeremonyResult<T>> {
  try {
    return { ok: true, value: await ceremony() };
  } catch (error) {
    return { ok: false, errorKey: webAuthnErrorKey(error) };
  }
}

/** Whether this browser can run a ceremony at all. Answers false on the server. */
export async function isWebAuthnSupported(): Promise<boolean> {
  if (typeof window === 'undefined') {
    return false;
  }

  const { browserSupportsWebAuthn } = await loadLibrary();
  return browserSupportsWebAuthn();
}

/**
 * Whether the device itself can hold a passkey, with Touch ID, Windows Hello
 * or the like. A false answer is not a blocker: a security key over USB or a
 * phone over Bluetooth still works, so this only decides what to suggest.
 */
export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (typeof window === 'undefined') {
    return false;
  }

  const { platformAuthenticatorIsAvailable } = await loadLibrary();
  return platformAuthenticatorIsAvailable();
}

/** Runs the create ceremony against the options the backend issued. */
export function createPasskey(
  optionsJSON: PublicKeyCredentialCreationOptionsJSON,
): Promise<CeremonyResult<RegistrationResponseJSON>> {
  return runCeremony(async () => {
    const { startRegistration } = await loadLibrary();
    return startRegistration({ optionsJSON });
  });
}

/** Runs the get ceremony against a passkey the browser already holds. */
export function assertPasskey(
  optionsJSON: PublicKeyCredentialRequestOptionsJSON,
): Promise<CeremonyResult<AuthenticationResponseJSON>> {
  return runCeremony(async () => {
    const { startAuthentication } = await loadLibrary();
    return startAuthentication({ optionsJSON });
  });
}
