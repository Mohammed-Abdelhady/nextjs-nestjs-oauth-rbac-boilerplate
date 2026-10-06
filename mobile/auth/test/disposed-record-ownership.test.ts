import { createApiClient } from '@app/sdk';
import { describe, expect, it } from 'vitest';
import { CREDENTIAL_DELETE_TIMEOUT_MS, CREDENTIAL_WRITE_TIMEOUT_MS } from '../src/constants';
import { classifyDisposedCredentialRecord } from '../src/credential-record-store';
import { persistRotatedSessionAfterDispose, settleDisposedToken } from '../src/refresh-dispose';
import { makeRefreshRecord } from '../src/refresh-helpers';
import { AuthRuntime } from '../src/runtime';
import { createSignOutOperation } from '../src/sign-out';
import type { RuntimeTokens } from '../src/types/record';
import { revokedTokens } from './tracking';
import { CONFIG, Deferred, ScriptedTransport, testPorts } from './support';

const INSTALL_DIGEST = 'disposed-lineage-install';
const LINEAGE_A = 'lineage-a';

const CLASSIFICATION_RECORD = {
  schemaVersion: 1,
  serverBaseAddress: CONFIG.serverBaseAddress,
  environment: CONFIG.environment,
  clientId: CONFIG.clientId,
  installDigest: INSTALL_DIGEST,
  lineageId: LINEAGE_A,
  tokens: { refreshToken: 'refresh-target' },
};

describe('disposed credential ownership classification', () => {
  it.each([
    { name: 'the held token in its lineage', record: CLASSIFICATION_RECORD, expected: 'OWN_SAME' },
    {
      name: 'a stable later token in its lineage',
      record: { ...CLASSIFICATION_RECORD, tokens: { refreshToken: 'refresh-successor' } },
      expected: 'OWN_OTHER',
    },
    {
      name: 'a later token in its lineage while its own refresh marker is present',
      record: {
        ...CLASSIFICATION_RECORD,
        tokens: { refreshToken: 'refresh-successor' },
        refreshInFlight: true,
      },
      expected: 'OWN_OTHER',
    },
    {
      name: 'a different lineage',
      record: { ...CLASSIFICATION_RECORD, lineageId: 'lineage-b' },
      expected: 'FOREIGN',
    },
    {
      name: 'a record without lineage and a different token',
      record: {
        schemaVersion: 1,
        serverBaseAddress: CONFIG.serverBaseAddress,
        environment: CONFIG.environment,
        clientId: CONFIG.clientId,
        installDigest: INSTALL_DIGEST,
        tokens: { refreshToken: 'refresh-old' },
      },
      expected: 'FOREIGN',
    },
    {
      name: 'a record without lineage and the exact token',
      record: {
        schemaVersion: 1,
        serverBaseAddress: CONFIG.serverBaseAddress,
        environment: CONFIG.environment,
        clientId: CONFIG.clientId,
        installDigest: INSTALL_DIGEST,
        tokens: { refreshToken: 'refresh-target' },
      },
      expected: 'FOREIGN',
    },
    { name: 'missing storage', expected: 'EMPTY' },
    { name: 'two unreadable storage results', readResult: 'unavailable', expected: 'UNREADABLE' },
  ] as const)('classifies $name', async ({ record, readResult, expected }) => {
    const ports = testPorts(new ScriptedTransport());
    const runtime = new AuthRuntime(CONFIG, ports);
    runtime.installDigest = INSTALL_DIGEST;
    if (record) ports.credentials.value = JSON.stringify(record);
    if (readResult === 'unavailable') ports.credentials.readResult = { kind: 'unavailable' };

    await expect(
      classifyDisposedCredentialRecord(runtime, {
        kind: 'session',
        installDigest: INSTALL_DIGEST,
        refreshToken: 'refresh-target',
        lineageId: LINEAGE_A,
      }),
    ).resolves.toBe(expected);
    if (expected === 'UNREADABLE')
      expect(ports.credentials.events.filter((event) => event === 'read')).toHaveLength(2);
    expect(ports.timer.pending).toBe(0);
  });
});
describe('disposed credential ownership', () => {
  it('sends one revoke when two disposed cleanup paths claim the same token', async () => {
    const transport = new ScriptedTransport();
    transport.respond = async ({ path }) => {
      if (path === '/api/oauth/revoke') return { status: 200, body: {} };
      throw new Error(`Unexpected request: ${path}`);
    };
    const ports = testPorts(transport);
    const runtime = disposedMarkerRuntime(ports);
    ports.credentials.value = undefined;
    const client = createApiClient(runtime.rawTransport);

    await Promise.all([
      settleDisposedToken(runtime, client, INSTALL_DIGEST, LINEAGE_A, 'late-refresh'),
      settleDisposedToken(runtime, client, INSTALL_DIGEST, LINEAGE_A, 'late-refresh'),
    ]);

    expect(revokedTokens(transport)).toEqual(['late-refresh']);
    expect(ports.timer.pending).toBe(0);
  });

  it('revokes a late rotation when an unrelated sign-in replaced the record', async () => {
    const transport = new ScriptedTransport();
    transport.respond = async ({ path }) => {
      if (path === '/api/oauth/revoke') return { status: 200, body: {} };
      throw new Error(`Unexpected request: ${path}`);
    };
    const ports = testPorts(transport);
    const runtime = new AuthRuntime(CONFIG, ports);
    const previous: RuntimeTokens = {
      accessToken: 'access-before',
      refreshToken: 'refresh-before',
      expiresAt: 0,
      version: 1,
      lineageId: 'lineage-a',
    };
    runtime.installDigest = INSTALL_DIGEST;
    runtime.tokens = previous;
    runtime.record = makeRefreshRecord(runtime, INSTALL_DIGEST, previous);
    runtime.setState('signedIn', 'none');
    const successor = {
      ...makeRefreshRecord(runtime, INSTALL_DIGEST, {
        accessToken: 'successor-access',
        refreshToken: 'successor-refresh',
        lineageId: 'lineage-b',
      }),
      lineageId: 'lineage-b',
    };
    ports.credentials.value = JSON.stringify(successor);
    const successorValue = ports.credentials.value;
    runtime.dispose();
    const client = createApiClient(runtime.rawTransport);
    const lateTokens = {
      accessToken: 'late-access',
      refreshToken: 'late-refresh',
      lineageId: 'lineage-a',
    };

    await persistRotatedSessionAfterDispose(runtime, client, INSTALL_DIGEST, 'refresh-before', {
      ...lateTokens,
    });

    expect(revokedTokens(transport)).toEqual(['late-refresh']);
    expect(ports.credentials.value).toBe(successorValue);
  });

  it('leaves a late refresh marker for restart recovery instead of deleting the live session', async () => {
    const transport = new ScriptedTransport();
    const ports = testPorts(transport);
    const runtime = new AuthRuntime(CONFIG, ports);
    const tokens: RuntimeTokens = {
      accessToken: 'marker-access',
      refreshToken: 'marker-refresh',
      expiresAt: 0,
      version: 1,
      lineageId: LINEAGE_A,
    };
    runtime.installDigest = INSTALL_DIGEST;
    runtime.tokens = tokens;
    const stableRecord = makeRefreshRecord(runtime, INSTALL_DIGEST, tokens);
    runtime.record = stableRecord;
    ports.credentials.value = JSON.stringify(stableRecord);
    runtime.setState('signedIn', 'refreshing');
    const markerWriteStarted = new Deferred<void>();
    const releaseMarkerWrite = new Deferred<void>();
    ports.credentials.beforeReplace = async (value) => {
      if (!value.includes('"refreshInFlight":true')) return;
      markerWriteStarted.resolve();
      await releaseMarkerWrite.promise;
    };
    const marker = makeRefreshRecord(runtime, INSTALL_DIGEST, tokens, true);
    const pendingWrite = runtime.replaceRecord(marker, runtime.epoch).catch(() => false);
    await markerWriteStarted.promise;
    ports.timer.fireDelay(CREDENTIAL_WRITE_TIMEOUT_MS);
    runtime.dispose();
    releaseMarkerWrite.resolve();
    await pendingWrite;
    await runtime.writeTail;

    expect(ports.credentials.value).toContain('"refreshInFlight":true');
    expect(ports.credentials.value).toContain('marker-refresh');
    expect(revokedTokens(transport)).toEqual([]);
    expect(ports.timer.pending).toBe(0);
  });

  it('does not let a late marker correction replace a timed-out sign-out delete', async () => {
    const transport = new ScriptedTransport();
    const revokeCompleted = new Deferred<void>();
    transport.respond = async ({ path }) => {
      if (path === '/api/oauth/revoke') return { status: 200, body: {} };
      throw new Error(`Unexpected request: ${path}`);
    };
    transport.onResponse = (request) => {
      if (request.path === '/api/oauth/revoke') revokeCompleted.resolve();
    };
    const ports = testPorts(transport);
    const runtime = new AuthRuntime(CONFIG, ports);
    const tokens: RuntimeTokens = {
      accessToken: 'marker-access',
      refreshToken: 'marker-refresh',
      expiresAt: 0,
      version: 1,
      lineageId: LINEAGE_A,
    };
    runtime.installDigest = INSTALL_DIGEST;
    runtime.tokens = tokens;
    runtime.record = makeRefreshRecord(runtime, INSTALL_DIGEST, tokens);
    runtime.setState('signedIn', 'none');
    ports.credentials.value = JSON.stringify(runtime.record);
    const marker = makeRefreshRecord(runtime, INSTALL_DIGEST, tokens, true);
    const markerWriteStarted = new Deferred<void>();
    const releaseMarkerWrite = new Deferred<void>();
    ports.credentials.beforeReplace = async (value) => {
      if (!value.includes('"refreshInFlight":true')) return;
      markerWriteStarted.resolve();
      await releaseMarkerWrite.promise;
    };
    const markerWrite = runtime.replaceRecord(marker, runtime.epoch).catch(() => false);
    await markerWriteStarted.promise;

    const signOut = createSignOutOperation(runtime, createApiClient(runtime.rawTransport))();
    runtime.dispose();
    await expect(signOut).resolves.toEqual({ kind: 'disposed' });
    await revokeCompleted.promise;
    ports.timer.fireDelay(CREDENTIAL_DELETE_TIMEOUT_MS);
    ports.timer.fireDelay(CREDENTIAL_WRITE_TIMEOUT_MS);
    releaseMarkerWrite.resolve();
    await markerWrite;
    await runtime.writeTail;

    expect(revokedTokens(transport)).toEqual(['marker-refresh']);
    expect(ports.credentials.value).toBeUndefined();
    expect(transport.sent.filter(({ path }) => path === '/api/oauth/token')).toHaveLength(0);
    expect(ports.timer.pending).toBe(0);
  });

  it('retries an unreadable ownership check before revoking a saved rotated token', async () => {
    const transport = new ScriptedTransport();
    transport.respond = async ({ path }) => {
      if (path === '/api/oauth/revoke') return { status: 200, body: {} };
      throw new Error(`Unexpected request: ${path}`);
    };
    const ports = testPorts(transport);
    const runtime = disposedMarkerRuntime(ports);
    let readCalls = 0;
    const read = ports.credentials.read.bind(ports.credentials);
    ports.credentials.read = async () => {
      readCalls += 1;
      if (readCalls === 2) throw new Error('temporary keychain read failure');
      return read();
    };
    ports.credentials.afterReplace = (value) => {
      if (value.includes('"refreshToken":"refresh-rotated"'))
        throw new Error('store reported a post-write failure');
    };

    await persistRotatedSessionAfterDispose(
      runtime,
      createApiClient(runtime.rawTransport),
      INSTALL_DIGEST,
      'refresh-before',
      { accessToken: 'access-rotated', refreshToken: 'refresh-rotated', lineageId: LINEAGE_A },
    );

    expect(revokedTokens(transport)).toEqual([]);
    expect(ports.credentials.value).toContain('refresh-rotated');
    expect(readCalls).toBe(3);
    expect(ports.timer.pending).toBe(0);
  });

  it('revokes after two unreadable checks and queues a guarded deletion', async () => {
    const transport = new ScriptedTransport();
    transport.respond = async ({ path }) => {
      if (path === '/api/oauth/revoke') return { status: 200, body: {} };
      throw new Error(`Unexpected request: ${path}`);
    };
    const ports = testPorts(transport);
    const runtime = disposedMarkerRuntime(ports);
    let readCalls = 0;
    const read = ports.credentials.read.bind(ports.credentials);
    ports.credentials.read = async () => {
      readCalls += 1;
      if (readCalls === 2 || readCalls === 3) throw new Error('temporary keychain read failure');
      return read();
    };
    ports.credentials.afterReplace = (value) => {
      if (value.includes('"refreshToken":"refresh-rotated"'))
        throw new Error('store reported a post-write failure');
    };

    await persistRotatedSessionAfterDispose(
      runtime,
      createApiClient(runtime.rawTransport),
      INSTALL_DIGEST,
      'refresh-before',
      { accessToken: 'access-rotated', refreshToken: 'refresh-rotated', lineageId: LINEAGE_A },
    );
    await runtime.writeTail;

    expect(revokedTokens(transport)).toEqual(['refresh-rotated']);
    expect(ports.credentials.value).toBeUndefined();
    expect(readCalls).toBe(4);
    expect(ports.timer.pending).toBe(0);
  });
});

function disposedMarkerRuntime(ports: ReturnType<typeof testPorts>): AuthRuntime {
  const runtime = new AuthRuntime(CONFIG, ports);
  const tokens: RuntimeTokens = {
    accessToken: 'access-before',
    refreshToken: 'refresh-before',
    expiresAt: 0,
    version: 1,
    lineageId: LINEAGE_A,
  };
  runtime.installDigest = INSTALL_DIGEST;
  runtime.tokens = tokens;
  runtime.record = {
    ...makeRefreshRecord(runtime, INSTALL_DIGEST, tokens, true),
    lineageId: LINEAGE_A,
  };
  ports.credentials.value = JSON.stringify(runtime.record);
  runtime.setState('signedIn', 'refreshing');
  runtime.dispose();
  return runtime;
}
