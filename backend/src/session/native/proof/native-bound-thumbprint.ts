export interface NativeBoundThumbprint {
  thumbprint?: string;
  inconsistent: boolean;
}

export function resolveNativeBoundThumbprint(
  sessionThumbprint?: string,
  credentialThumbprint?: string,
): NativeBoundThumbprint {
  if (
    sessionThumbprint &&
    credentialThumbprint &&
    sessionThumbprint !== credentialThumbprint
  ) {
    return { inconsistent: true };
  }
  return {
    thumbprint: sessionThumbprint ?? credentialThumbprint,
    inconsistent: false,
  };
}
