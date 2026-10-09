import { describe, expect, it } from 'vitest';
import { makeRefreshRecord } from '../../../src/refresh/refresh-helpers';
import { AuthRuntime } from '../../../src/runtime/runtime';
import type { RuntimeTokens } from '../../../src/types/record';
import { CONFIG, ScriptedTransport, testPorts } from '../../support/support';

const INSTALL_DIGEST = 'marker-queue-install';
const TOKENS: RuntimeTokens = {
  accessToken: 'marker-access',
  refreshToken: 'marker-refresh',
  expiresAt: 0,
  version: 1,
  lineageId: 'marker-queue-lineage',
};

describe('a refresh marker queued when disposal lands', () => {
  it('does not replace a stable record with a marker after disposal', async () => {
    const transport = new ScriptedTransport();
    const ports = testPorts(transport);
    const runtime = new AuthRuntime(CONFIG, ports);
    runtime.installDigest = INSTALL_DIGEST;
    runtime.tokens = TOKENS;
    runtime.record = makeRefreshRecord(runtime, INSTALL_DIGEST, TOKENS);
    ports.credentials.value = JSON.stringify(runtime.record);
    runtime.setState('signedIn', 'none');
    const original = ports.credentials.value;
    runtime.dispose();
    const marker = makeRefreshRecord(runtime, INSTALL_DIGEST, TOKENS, true);

    await expect(runtime.replaceRecord(marker, runtime.epoch)).resolves.toBe(false);

    expect(ports.credentials.value).toBe(original);
    expect(transport.sent.filter(({ path }) => path === '/api/oauth/token')).toHaveLength(0);
    expect(ports.timer.pending).toBe(0);
  });
});
