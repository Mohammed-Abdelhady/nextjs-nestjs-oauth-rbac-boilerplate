import type { Session } from '@app/sdk';
import {
  ACTIVE_NOW_WINDOW_MS,
  ACTIVITY,
  API_FAILURE,
  LIST_VIEW,
  SESSION_KIND,
  type Activity,
  type SessionKind,
} from '../constants';
import type { ApiFailure, SessionRow, SessionsView } from '../types';
import { deviceNameOf } from './device-name';

const KIND_BY_PURPOSE = new Map<string, SessionKind>([
  ['browser_session', SESSION_KIND.BROWSER],
  ['native_access', SESSION_KIND.NATIVE_APP],
]);

function sameDay(first: number, second: number): boolean {
  return new Date(first).toDateString() === new Date(second).toDateString();
}

export function activityOf(lastActiveAt: number, now: number): Activity {
  if (now - lastActiveAt < ACTIVE_NOW_WINDOW_MS) return ACTIVITY.NOW;
  return sameDay(lastActiveAt, now) ? ACTIVITY.TODAY : ACTIVITY.EARLIER;
}

/** An unreadable date sorts last and reads as earlier, instead of as active now. */
function lastActiveOf(session: Session): number {
  const parsed = Date.parse(session.lastUsedAt ?? session.createdAt);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function toSessionRow(session: Session, now: number): SessionRow {
  const kind = KIND_BY_PURPOSE.get(session.credentialPurpose);
  const lastActiveAt = lastActiveOf(session);
  return {
    id: session.id,
    isCurrent: session.isCurrent,
    device: deviceNameOf(session, kind === SESSION_KIND.NATIVE_APP),
    kind,
    ip: session.ip,
    activity: activityOf(lastActiveAt, now),
    lastActiveAt,
  };
}

interface SessionsQuery {
  sessions: readonly Session[] | undefined;
  failure: ApiFailure | undefined;
  now: number;
}

/** Loading, error, empty or ready, with this device apart from the others, newest first. */
export function sessionsView({ sessions, failure, now }: SessionsQuery): SessionsView {
  if (sessions === undefined) {
    const view = failure === undefined ? LIST_VIEW.LOADING : LIST_VIEW.ERROR;
    return { view, current: undefined, others: [], ...(failure ? { failure } : {}) };
  }
  const rows = sessions.map((session) => toSessionRow(session, now));
  const others = rows
    .filter((row) => !row.isCurrent)
    .sort((first, second) => second.lastActiveAt - first.lastActiveAt);
  return {
    view: others.length === 0 ? LIST_VIEW.EMPTY : LIST_VIEW.READY,
    current: rows.find((row) => row.isCurrent),
    others,
  };
}

export function isOffline(failure: ApiFailure | undefined): boolean {
  return failure?.kind === API_FAILURE.OFFLINE;
}
