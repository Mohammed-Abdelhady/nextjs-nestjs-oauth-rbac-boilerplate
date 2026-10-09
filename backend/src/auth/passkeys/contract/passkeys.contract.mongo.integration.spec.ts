import {
  SESSION_AUTHORITY_BOOT_TIMEOUT_MS,
  SESSION_AUTHORITY_TEARDOWN_TIMEOUT_MS,
} from '../../../../test/utils/session-authority-harness';
import { bootMongoPasskeysHarness } from './mongo-passkeys.harness-spec';
import { describePasskeysContract } from './passkeys-contract-suite.harness-spec';

describePasskeysContract('MongoDB', bootMongoPasskeysHarness, {
  bootMs: SESSION_AUTHORITY_BOOT_TIMEOUT_MS,
  teardownMs: SESSION_AUTHORITY_TEARDOWN_TIMEOUT_MS,
});
