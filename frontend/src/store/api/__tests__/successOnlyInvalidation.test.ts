// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { refusal, registerFormTestLifecycle, success } from '@/tests/serverRejectionHarness';
import { CONVERTED, EXCEPTIONS } from './invalidationRefetchCases';
import { UNTAGGED } from './untaggedRefetchCases';
import { describeSuccessOnly, describeUntagged, requestsOf } from './mutationSweepBase';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

registerFormTestLifecycle();

describeSuccessOnly(CONVERTED);
describeUntagged(UNTAGGED);

// The success-only and untagged suites live in the shared base; the
// session-revocation suite is only used here.
describe.each(EXCEPTIONS)('$name invalidates even when refused', (mutation) => {
  it('repeats its reads after a 400 refusal', async () => {
    const requests = await requestsOf(mutation, () => refusal(['name']));
    expect(requests.slice(mutation.requests.length).sort()).toEqual([...mutation.refetched].sort());
  });

  it('also repeats its reads after the server accepted it', async () => {
    const requests = await requestsOf(mutation, () => success(mutation.accepted));
    expect(requests.slice(mutation.requests.length).sort()).toEqual([...mutation.refetched].sort());
  });
});
