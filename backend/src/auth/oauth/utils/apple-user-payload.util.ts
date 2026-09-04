interface AppleUserPayload {
  name?: {
    firstName?: string;
    lastName?: string;
  };
  email?: string;
}

/**
 * Reads the display name out of Apple's `user` form field.
 *
 * Apple sends this JSON string once, with the callback of the first
 * authorization, and never again. A malformed or absent payload is not an
 * error: the caller falls back to the email address.
 */
export function readAppleUserName(rawPayload?: string): string | undefined {
  if (!rawPayload) {
    return undefined;
  }

  let payload: AppleUserPayload;
  try {
    payload = JSON.parse(rawPayload) as AppleUserPayload;
  } catch {
    return undefined;
  }

  const parts = [payload.name?.firstName, payload.name?.lastName]
    .filter((part): part is string => typeof part === 'string')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  return parts.length > 0 ? parts.join(' ') : undefined;
}
