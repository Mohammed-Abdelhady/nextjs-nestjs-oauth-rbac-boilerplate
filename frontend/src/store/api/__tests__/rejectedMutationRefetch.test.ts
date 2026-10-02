// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import {
  makeStore,
  refusal,
  registerFormTestLifecycle,
  stubNetwork,
  success,
  type TestStore,
} from '@/tests/serverRejectionHarness';
import { baseApi } from '@/store/api/baseApi';
import { authApi } from '@/modules/auth/store/authApi';
import { sessionsApi } from '@/modules/sessions/api/sessionsApi';
import { usersApi } from '@/modules/users/api/usersApi';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

const PROFILE = {
  id: 'user-1',
  email: 'layla@example.com',
  name: 'Layla Haddad',
  role: 'admin',
  permissions: [],
  authProvider: 'email',
  isVerified: true,
  linkedProviders: ['email'],
};

const ADMIN_USER = {
  id: 'user-2',
  email: 'omar@example.com',
  name: 'Omar Nasser',
  role: 'user',
  isVerified: true,
  isDeleted: false,
  authProvider: 'email',
  linkedProviders: ['email'],
  createdAt: '2026-10-01T12:00:00.000Z',
  updatedAt: '2026-10-01T12:00:00.000Z',
};

/** What every read answers, by path. */
const READS: Record<string, unknown> = {
  '/api/user/profile': PROFILE,
  '/api/user/sessions': { sessions: [] },
  '/api/admin/users': {
    data: [ADMIN_USER],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
  },
  '/api/admin/users/user-2': ADMIN_USER,
};

type Dispatched = (store: TestStore) => PromiseLike<unknown>;

const readProfile: Dispatched = (store) =>
  store.dispatch(authApi.endpoints.getCurrentUser.initiate());
const readSessions: Dispatched = (store) =>
  store.dispatch(sessionsApi.endpoints.getSessions.initiate());
const readUsers: Dispatched = (store) => store.dispatch(usersApi.endpoints.getUsers.initiate({}));
const readUser: Dispatched = (store) =>
  store.dispatch(usersApi.endpoints.getUserById.initiate('user-2'));

interface MutationCase {
  name: string;
  /** Queries a page keeps subscribed while the form is open, in this order. */
  reads: Dispatched[];
  write: Dispatched;
  /** What the server answers when it accepts the write. */
  accepted: unknown;
  /** Requests up to and including the write. */
  requests: string[];
  /** Reads the cache repeats after an accepted write. A refused write repeats none. */
  refetched: string[];
}

const CASES: MutationCase[] = [
  {
    name: 'updateProfile',
    reads: [readProfile],
    write: (store) => store.dispatch(authApi.endpoints.updateProfile.initiate({ name: 'Layla H' })),
    accepted: PROFILE,
    requests: ['GET /api/user/profile', 'PATCH /api/user/profile'],
    refetched: ['GET /api/user/profile'],
  },
  {
    name: 'changePassword',
    reads: [readProfile, readSessions],
    write: (store) =>
      store.dispatch(
        authApi.endpoints.changePassword.initiate({
          currentPassword: 'OldPassw0rdLayla',
          newPassword: 'NewPassw0rdLayla',
        }),
      ),
    accepted: { message: 'Password changed' },
    requests: ['GET /api/user/profile', 'GET /api/user/sessions', 'POST /api/user/password'],
    refetched: ['GET /api/user/sessions'],
  },
  {
    name: 'createUser',
    reads: [readProfile, readUsers],
    write: (store) =>
      store.dispatch(
        usersApi.endpoints.createUser.initiate({
          email: 'omar@example.com',
          name: 'Omar Nasser',
          password: 'Passw0rd!Omar',
          role: 'user',
        }),
      ),
    accepted: ADMIN_USER,
    requests: ['GET /api/user/profile', 'GET /api/admin/users', 'POST /api/admin/users'],
    refetched: ['GET /api/admin/users'],
  },
  {
    name: 'updateUser',
    reads: [readProfile, readUsers, readUser],
    write: (store) =>
      store.dispatch(
        usersApi.endpoints.updateUser.initiate({
          userId: 'user-2',
          name: 'Omar N',
          email: 'omar@example.com',
        }),
      ),
    accepted: ADMIN_USER,
    requests: [
      'GET /api/user/profile',
      'GET /api/admin/users',
      'GET /api/admin/users/user-2',
      'PATCH /api/admin/users/user-2',
    ],
    refetched: ['GET /api/admin/users', 'GET /api/admin/users/user-2'],
  },
  {
    name: 'register',
    reads: [readProfile],
    write: (store) =>
      store.dispatch(
        authApi.endpoints.register.initiate({
          name: 'Omar Nasser',
          email: 'omar@example.com',
          password: 'Passw0rdOmar',
        }),
      ),
    accepted: { email: 'omar@example.com' },
    requests: ['GET /api/user/profile', 'POST /api/auth/register'],
    refetched: [],
  },
];

/** Runs the reads, then the write, and waits for every refetch the write caused. */
async function requestsOf(mutation: MutationCase, writeAnswer: () => Response): Promise<string[]> {
  const requests = stubNetwork((request, path) =>
    request.method === 'GET' ? success(READS[path]) : writeAnswer(),
  );
  const store = makeStore();
  for (const read of mutation.reads) {
    await read(store);
  }
  await mutation.write(store);
  await Promise.all(store.dispatch(baseApi.util.getRunningQueriesThunk()));
  return requests;
}

registerFormTestLifecycle();

describe.each(CASES)('$name', (mutation) => {
  it('issues no read after the server refused it', async () => {
    const requests = await requestsOf(mutation, () => refusal(['name']));

    expect(requests).toEqual(mutation.requests);
  });

  it('repeats only its own reads after the server accepted it', async () => {
    const requests = await requestsOf(mutation, () => success(mutation.accepted));

    expect(requests.slice(0, mutation.requests.length)).toEqual(mutation.requests);
    expect(requests.slice(mutation.requests.length).sort()).toEqual(mutation.refetched);
  });
});

describe('session status during a profile refetch', () => {
  const status = (store: TestStore) => store.getState().auth.validationStatus;
  const refetchProfile = (store: TestStore) =>
    store.dispatch(authApi.endpoints.getCurrentUser.initiate(undefined, { forceRefetch: true }));

  it('is pending on the first read and stays succeeded while a later one is in flight', async () => {
    let release: (response: Response) => void = () => undefined;
    const held = new Promise<Response>((resolve) => {
      release = resolve;
    });
    let reads = 0;
    stubNetwork(() => {
      reads += 1;
      return reads === 1 ? success(PROFILE) : held;
    });
    const store = makeStore();
    expect(status(store)).toBe('idle');

    const first = readProfile(store);
    expect(status(store)).toBe('pending');
    await first;
    expect(status(store)).toBe('succeeded');

    const refetch = refetchProfile(store);
    expect(status(store)).toBe('succeeded');
    release(success(PROFILE));
    await refetch;
    expect(status(store)).toBe('succeeded');
  });

  it('ends the session when the refetch answers that it is gone', async () => {
    let reads = 0;
    stubNetwork(() => {
      reads += 1;
      return reads === 1
        ? success(PROFILE)
        : Response.json(
            { success: false, error: { code: 'SESSION_INVALID', message: 'Signed out' } },
            { status: 401 },
          );
    });
    const store = makeStore();
    await readProfile(store);

    await refetchProfile(store);

    expect(status(store)).toBe('failed');
    expect(store.getState().auth.isAuthenticated).toBe(false);
  });
});
