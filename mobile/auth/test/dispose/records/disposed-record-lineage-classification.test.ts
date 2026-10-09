import { createApiClient } from '@app/sdk';
import { describe, expect, it } from 'vitest';
import { classifyDisposedCredentialRecord } from '../../../src/storage/credential-record-store';
import { settleDisposedToken } from '../../../src/refresh/refresh-dispose';
import { AuthRuntime } from '../../../src/runtime/runtime';
import { CONFIG, ScriptedTransport, testPorts } from '../../support/support';

const INSTALL_DIGEST = 'lineage-classification-install';

describe('disposed lineage classification', () => {
  it('treats an unlineaged record as foreign even when both sides lack a lineage', async () => {
    const ports = testPorts(new ScriptedTransport());
    const runtime = new AuthRuntime(CONFIG, ports);
    runtime.installDigest = INSTALL_DIGEST;
    ports.credentials.value = JSON.stringify({
      schemaVersion: 1,
      serverBaseAddress: CONFIG.serverBaseAddress,
      environment: CONFIG.environment,
      clientId: CONFIG.clientId,
      installDigest: INSTALL_DIGEST,
      tokens: { refreshToken: 'refresh-without-lineage' },
    });

    await expect(
      classifyDisposedCredentialRecord(runtime, {
        kind: 'session',
        installDigest: INSTALL_DIGEST,
        refreshToken: 'refresh-without-lineage',
      }),
    ).resolves.toBe('FOREIGN');
    expect(ports.timer.pending).toBe(0);
  });

  it.each([
    ['my sent predecessor', 'refresh-sent', 'FOREIGN'],
    ['a later refresh in my lineage', 'refresh-successor', 'OWN_OTHER'],
    ['my own late token', 'refresh-late', 'OWN_SAME'],
  ] as const)('classifies %s when settling a late token', async (_name, storedToken, expected) => {
    const ports = testPorts(new ScriptedTransport());
    const runtime = new AuthRuntime(CONFIG, ports);
    runtime.installDigest = INSTALL_DIGEST;
    ports.credentials.value = JSON.stringify({
      schemaVersion: 1,
      serverBaseAddress: CONFIG.serverBaseAddress,
      environment: CONFIG.environment,
      clientId: CONFIG.clientId,
      installDigest: INSTALL_DIGEST,
      lineageId: 'lineage-one',
      tokens: { refreshToken: storedToken },
      refreshInFlight: true,
    });

    await expect(
      classifyDisposedCredentialRecord(runtime, {
        kind: 'session',
        installDigest: INSTALL_DIGEST,
        refreshToken: 'refresh-late',
        sentRefreshToken: 'refresh-sent',
        lineageId: 'lineage-one',
      }),
    ).resolves.toBe(expected);
    expect(ports.timer.pending).toBe(0);
  });

  it('keeps an already stored late token without revoking it', async () => {
    const transport = new ScriptedTransport();
    const ports = testPorts(transport);
    const runtime = new AuthRuntime(CONFIG, ports);
    runtime.installDigest = INSTALL_DIGEST;
    const serialized = JSON.stringify({
      schemaVersion: 1,
      serverBaseAddress: CONFIG.serverBaseAddress,
      environment: CONFIG.environment,
      clientId: CONFIG.clientId,
      installDigest: INSTALL_DIGEST,
      lineageId: 'lineage-one',
      tokens: { refreshToken: 'refresh-late' },
    });
    ports.credentials.value = serialized;

    await settleDisposedToken(
      runtime,
      createApiClient(transport),
      INSTALL_DIGEST,
      'lineage-one',
      'refresh-late',
      'refresh-sent',
    );

    expect(ports.credentials.value).toBe(serialized);
    expect(transport.sent.filter(({ path }) => path === '/api/oauth/revoke')).toHaveLength(0);
    expect(ports.timer.pending).toBe(0);
  });
});
