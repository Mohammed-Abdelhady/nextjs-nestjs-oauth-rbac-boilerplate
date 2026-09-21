import { configureStore } from '@reduxjs/toolkit';
import { afterEach, expect, test, vi } from 'vitest';
import { BROWSER_PROOF_ENDPOINT, CSRF_ENDPOINT } from '@/constants/api';
import { CSRF_HEADER, clearBrowserProof } from '@/store/api/browser-proof';
import { usersApi } from './usersApi';

afterEach(() => {
  clearBrowserProof();
  vi.unstubAllGlobals();
});

test('a bodyless delete sends the session csrf token and refreshes the user list', async () => {
  clearBrowserProof();
  let deleted = false;
  const requests: string[] = [];
  vi.stubGlobal('fetch', async (request: Request) => {
    requests.push(request.method);
    const pathname = new URL(request.url).pathname;
    if (pathname === CSRF_ENDPOINT) {
      return Response.json(
        { success: true, data: { token: 'session-proof-token' } },
        { headers: { [CSRF_HEADER]: 'session-proof-token' } },
      );
    }
    if (pathname === BROWSER_PROOF_ENDPOINT) {
      throw new Error('a signed-in request must not ask for a pre-session proof');
    }
    if (request.method === 'DELETE') {
      expect(pathname).toBe('/api/admin/users/fixture-user');
      expect(request.headers.get(CSRF_HEADER)).toBe('session-proof-token');
      deleted = true;
      return new Response(null, { status: 204 });
    }
    return Response.json({
      success: true,
      data: {
        data: [{ id: 'fixture-user', name: 'Fixture User', isActive: !deleted }],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      },
    });
  });
  const store = configureStore({
    reducer: { [usersApi.reducerPath]: usersApi.reducer },
    middleware: (defaults) => defaults().concat(usersApi.middleware),
  });
  const list = store.dispatch(usersApi.endpoints.getUsers.initiate({}));
  try {
    expect((await list.unwrap()).users).toHaveLength(1);
    const result = await store.dispatch(usersApi.endpoints.deleteUser.initiate('fixture-user'));
    expect(result).not.toHaveProperty('error');
    await vi.waitFor(() => {
      expect(usersApi.endpoints.getUsers.select({})(store.getState()).data?.users).toMatchObject([
        { _id: 'fixture-user', isActive: false },
      ]);
    });
    expect(requests).toEqual(['GET', 'GET', 'DELETE', 'GET']);
  } finally {
    list.unsubscribe();
    store.dispatch(usersApi.util.resetApiState());
  }
});
