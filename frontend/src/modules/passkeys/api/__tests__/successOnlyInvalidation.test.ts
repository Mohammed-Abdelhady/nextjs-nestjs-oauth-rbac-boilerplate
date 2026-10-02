// @vitest-environment jsdom
import { vi } from 'vitest';
import { registerFormTestLifecycle } from '@/tests/serverRejectionHarness';
import { describeSuccessOnly, describeUntagged } from '@/store/api/__tests__/mutationSweepBase';
import { CONVERTED, UNTAGGED, extraReads } from './sweepCases';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

registerFormTestLifecycle();

describeSuccessOnly(CONVERTED, extraReads);
describeUntagged(UNTAGGED, extraReads);
