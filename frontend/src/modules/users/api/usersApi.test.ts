import { configureStore } from '@reduxjs/toolkit';
import { afterEach, expect, test, vi } from 'vitest';
import { usersApi } from './usersApi';

afterEach(() => vi.unstubAllGlobals());

test('a bodyless delete succeeds and refreshes the subscribed user list', async () => {
  let deleted = false;
  const requests: string[] = [];
  vi.stubGlobal('fetch', async (request: Request) => {
    requests.push(request.method);
    if (request.method === 'DELETE') {
      expect(new URL(request.url).pathname).toBe('/api/admin/users/fixture-user');
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
    expect(requests).toEqual(['GET', 'DELETE', 'GET']);
  } finally {
    list.unsubscribe();
    store.dispatch(usersApi.util.resetApiState());
  }
});
