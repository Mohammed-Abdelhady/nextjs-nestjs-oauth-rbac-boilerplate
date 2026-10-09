/**
 * Identifies the current session from the authenticated request.
 *
 * Every route that needs "the current session" uses this helper on
 * `request.session`, so cookie and bearer callers are treated alike. Reading
 * the session cookie here would leave bearer callers with no current session.
 */
export interface RequestWithSession {
  session?: { _id?: { toString(): string } | string } | null;
}

export function requestSessionId(request: RequestWithSession): string | null {
  const id = request.session?._id;
  if (typeof id === 'string') {
    return id.length > 0 ? id : null;
  }
  if (id === undefined || id === null) {
    return null;
  }
  const text = id.toString();
  return text.length > 0 ? text : null;
}
