'use client';

import { useEffect, useState } from 'react';
import { isPlatformAuthenticatorAvailable, isWebAuthnSupported } from '../utils/webauthn';
import { PASSKEY_SUPPORT, type PasskeySupport } from '../types';

/**
 * Reads one thing the browser knows about itself.
 *
 * The answer only exists in the browser, so it starts as null and settles
 * after mount. Treating null as false would render the fallback on the server
 * and then swap it out.
 */
function useBrowserCapability(read: () => Promise<boolean>): boolean | null {
  const [value, setValue] = useState<boolean | null>(null);

  useEffect(() => {
    let isCurrent = true;

    read()
      .then((result) => {
        if (isCurrent) setValue(result);
      })
      .catch(() => {
        if (isCurrent) setValue(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [read]);

  return value;
}

/** Whether this browser can run a passkey ceremony. */
export function usePasskeySupport(): PasskeySupport {
  const isSupported = useBrowserCapability(isWebAuthnSupported);

  if (isSupported === null) {
    return PASSKEY_SUPPORT.CHECKING;
  }

  return isSupported ? PASSKEY_SUPPORT.SUPPORTED : PASSKEY_SUPPORT.UNSUPPORTED;
}

/**
 * Whether the device can hold a passkey itself, with Touch ID, Windows Hello
 * or the like. Null until the check settles. False is worth saying out loud
 * but is not a blocker: a security key or a phone still works.
 */
export function usePlatformAuthenticator(): boolean | null {
  return useBrowserCapability(isPlatformAuthenticatorAvailable);
}
