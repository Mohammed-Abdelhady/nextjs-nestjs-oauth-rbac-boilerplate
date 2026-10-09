export function requestToken(body: unknown): string | undefined {
  if (
    typeof body === 'object' &&
    body !== null &&
    'token' in body &&
    typeof body.token === 'string'
  )
    return body.token;
  return undefined;
}

export function refreshParent(body: unknown): string | undefined {
  if (
    typeof body === 'object' &&
    body !== null &&
    'refresh_token' in body &&
    typeof body.refresh_token === 'string'
  )
    return body.refresh_token;
  return undefined;
}
