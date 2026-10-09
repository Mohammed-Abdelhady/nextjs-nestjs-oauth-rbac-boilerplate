import type { AbortSignalPort } from '@app/native-auth';
import {
  API_PATHS,
  TransportError,
  type Session,
  type Transport,
  type TransportRequest,
  type TransportResponse,
} from '@app/sdk';
import { deferred, type Deferred } from './fake-engine';

export const ok = (data: unknown): TransportResponse => ({
  status: 200,
  body: { success: true, data },
});

export const refusal = (status: number, code: string): TransportResponse => ({
  status,
  body: { success: false, error: { code, message: code } },
});

export const noResponse = (): TransportError => new TransportError();

export function session(id: string, overrides: Partial<Session> = {}): Session {
  return {
    id,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0 Safari/537.36',
    ip: '203.0.113.7',
    createdAt: '2026-06-01T08:00:00.000Z',
    lastUsedAt: '2026-06-10T08:00:00.000Z',
    isCurrent: false,
    credentialPurpose: 'browser_session',
    ...overrides,
  };
}

export const sessionList = (sessions: Session[]): TransportResponse =>
  ok({ sessions, total: sessions.length });

interface Held {
  request: TransportRequest<AbortSignalPort>;
  answer: Deferred<TransportResponse>;
}

export interface FakeServer {
  transport: Transport<AbortSignalPort>;
  /** Every request, in the order it was sent, as `METHOD path`. */
  sent(): string[];
  /** Answers the oldest unanswered request to this route. */
  answer(route: string, response: TransportResponse): void;
  fail(route: string, error: unknown): void;
}

/** The network boundary. Each request waits until the test answers it. */
export function createFakeServer(): FakeServer {
  const held: Held[] = [];
  const log: string[] = [];
  const routeOf = (request: TransportRequest<AbortSignalPort>): string =>
    `${request.method} ${request.path}`;
  const take = (route: string): Held => {
    const index = held.findIndex((entry) => routeOf(entry.request) === route);
    const [entry] = index === -1 ? [] : held.splice(index, 1);
    if (entry === undefined) throw new Error(`No unanswered request to ${route}`);
    return entry;
  };
  return {
    transport: {
      request(request) {
        const answer = deferred<TransportResponse>();
        held.push({ request, answer });
        log.push(routeOf(request));
        return answer.promise;
      },
    },
    sent: () => [...log],
    answer: (route, response) => take(route).answer.resolve(response),
    fail: (route, error) => take(route).answer.reject(error),
  };
}

export const ROUTE = {
  SESSIONS: `GET ${API_PATHS.user.sessions}`,
  PROFILE: `GET ${API_PATHS.user.profile}`,
  REVOKE_OTHERS: `POST ${API_PATHS.user.revokeOtherSessions}`,
  revoke: (id: string) => `DELETE /api/user/sessions/${id}`,
} as const;

/** Lets every promise already resolved run its continuations. */
export async function settle(): Promise<void> {
  for (let turn = 0; turn < 20; turn += 1) await Promise.resolve();
}
