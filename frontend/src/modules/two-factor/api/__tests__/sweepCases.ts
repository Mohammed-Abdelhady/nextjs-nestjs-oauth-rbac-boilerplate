import { twoFactorApi } from '../twoFactorApi';
import type { MutationCase } from '@/store/api/__tests__/mutationSweepBase';
import { GET_PROFILE, LOGIN_RESPONSE, readProfile } from '@/store/api/__tests__/mutationSweepBase';

/** TOTP mutations that do not invalidate on a 4xx. */
export const CONVERTED: MutationCase[] = [
  {
    name: 'confirmTwoFactor',
    reads: [readProfile],
    write: (store) =>
      store.dispatch(twoFactorApi.endpoints.confirmTwoFactor.initiate({ code: '123456' })),
    accepted: { recoveryCodes: ['abcd-1234', 'efgh-5678'] },
    requests: [GET_PROFILE, 'POST /api/auth/2fa/confirm'],
    refetched: [GET_PROFILE],
  },
  {
    name: 'disableTwoFactor',
    reads: [readProfile],
    write: (store) =>
      store.dispatch(
        twoFactorApi.endpoints.disableTwoFactor.initiate({ password: 'Passw0rd!Layla' }),
      ),
    accepted: { message: 'Two-factor disabled' },
    requests: [GET_PROFILE, 'POST /api/auth/2fa/disable'],
    refetched: [GET_PROFILE],
  },
  {
    name: 'verifyTwoFactor',
    reads: [readProfile],
    write: (store) =>
      store.dispatch(twoFactorApi.endpoints.verifyTwoFactor.initiate({ code: '123456' })),
    accepted: LOGIN_RESPONSE,
    requests: [GET_PROFILE, 'POST /api/auth/2fa/verify'],
    refetched: [GET_PROFILE],
  },
];

/**
 * TOTP ceremonies that invalidate nothing. They subscribe the read of the
 * tag the two factor sweeps touch — User — so a mutation that gains it makes
 * these rows fail.
 */
export const UNTAGGED: MutationCase[] = [
  {
    name: 'setupTwoFactor',
    reads: [readProfile],
    write: (store) =>
      store.dispatch(
        twoFactorApi.endpoints.setupTwoFactor.initiate({ password: 'Passw0rd!Layla' }),
      ),
    accepted: { otpauthUrl: 'otpauth://totp/x?secret=JBSWY3DP', secret: 'JBSWY3DP' },
    requests: [GET_PROFILE, 'POST /api/auth/2fa/setup'],
    refetched: [],
  },
  {
    name: 'regenerateRecoveryCodes',
    reads: [readProfile],
    write: (store) =>
      store.dispatch(twoFactorApi.endpoints.regenerateRecoveryCodes.initiate({ code: '123456' })),
    accepted: { recoveryCodes: ['new1-2233', 'new2-4455'] },
    requests: [GET_PROFILE, 'POST /api/auth/2fa/recovery-codes/regenerate'],
    refetched: [],
  },
];
