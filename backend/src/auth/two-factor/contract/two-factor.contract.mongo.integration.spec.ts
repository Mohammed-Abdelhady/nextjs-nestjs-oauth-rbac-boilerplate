import {
  SESSION_AUTHORITY_BOOT_TIMEOUT_MS,
  SESSION_AUTHORITY_TEARDOWN_TIMEOUT_MS,
} from '../../../../test/utils/session-authority-harness';
import { bootMongoTwoFactorHarness } from './mongo-two-factor.harness-spec';
import { describeTwoFactorContract } from './two-factor-contract-suite.harness-spec';

describeTwoFactorContract('MongoDB', bootMongoTwoFactorHarness, {
  bootMs: SESSION_AUTHORITY_BOOT_TIMEOUT_MS,
  teardownMs: SESSION_AUTHORITY_TEARDOWN_TIMEOUT_MS,
});
