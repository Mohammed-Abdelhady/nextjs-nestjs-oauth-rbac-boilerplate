// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import {
  makeStore,
  registerFormTestLifecycle,
  success,
  stubNetwork,
  type TestStore,
} from '@/tests/serverRejectionHarness';
import { PROFILE, readProfile } from './mutationSweepBase';
import { authApi } from '@/modules/auth/store/authApi';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

registerFormTestLifecycle();

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
