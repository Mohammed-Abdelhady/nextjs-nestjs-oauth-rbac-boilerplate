import { magicLinkApi } from '../magicLinkApi';
import type { MutationCase } from '@/store/api/__tests__/mutationSweepBase';
import { GET_PROFILE, LOGIN_RESPONSE, readProfile } from '@/store/api/__tests__/mutationSweepBase';

/** Magic link mutations that do not invalidate on a 4xx. */
export const CONVERTED: MutationCase[] = [
  {
    name: 'verifyMagicLink',
    reads: [readProfile],
    write: (store) =>
      store.dispatch(magicLinkApi.endpoints.verifyMagicLink.initiate({ token: 'link-token' })),
    accepted: LOGIN_RESPONSE,
    requests: [GET_PROFILE, 'POST /api/auth/magic-link/verify'],
    refetched: [GET_PROFILE],
  },
];

/**
 * The request step invalidates nothing. It subscribes the read of the tag
 * the magic link sweeps touch — User — so a mutation that gains it makes
 * this row fail.
 */
export const UNTAGGED: MutationCase[] = [
  {
    name: 'requestMagicLink',
    reads: [readProfile],
    write: (store) =>
      store.dispatch(
        magicLinkApi.endpoints.requestMagicLink.initiate({ email: 'omar@example.com' }),
      ),
    accepted: { email: 'omar@example.com' },
    requests: [GET_PROFILE, 'POST /api/auth/magic-link/request'],
    refetched: [],
  },
];
