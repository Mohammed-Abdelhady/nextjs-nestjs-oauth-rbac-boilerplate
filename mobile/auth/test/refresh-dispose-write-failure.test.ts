import { createApiClient } from '@app/sdk';
import type { Transport } from '@app/sdk';
import type { AbortSignalPort } from '../src';
import { describe, expect, it } from 'vitest';
import { AuthSessionError } from '../src/errors';
import { createRefreshCoordinator } from '../src/refresh';
import { persistRotatedSessionAfterDispose } from '../src/refresh-dispose';
import { makeRefreshRecord } from '../src/refresh-helpers';
import { AuthRuntime } from '../src/runtime';
import type { RuntimeTokens } from '../src/types/record';
import { revokedTokens } from './tracking';
import { CONFIG, Deferred, ScriptedTransport, oauthTokenReply, testPorts } from './support';

const INSTALL_DIGEST = 'install-digest';

describe('dispose during a refresh record write', () => {
  it('keeps the rotated session when disposal lands after its atomic write starts', async () => {
    const transport = new ScriptedTransport();
    const ports = testPorts(transport);
    const runtime = new AuthRuntime(CONFIG, ports);
    const previous: RuntimeTokens = {
      accessToken: 'access-before-refresh',
      refreshToken: 'refresh-before-refresh',
      expiresAt: 0,
      version: 1,
      lineageId: 'refresh-write-lineage',
    };
    runtime.installDigest = INSTALL_DIGEST;
    runtime.tokens = previous;
    runtime.record = makeRefreshRecord(runtime, INSTALL_DIGEST, previous);
    runtime.lastOAuthTokenSentAt = 1000;
    runtime.setState('signedIn', 'none');
    ports.credentials.value = JSON.stringify(runtime.record);

    const writeStarted = new Deferred<void>();
    const releaseWrite = new Deferred<void>();
    ports.credentials.beforeReplace = (value) => {
      if (!value.includes('refresh-after-refresh')) return Promise.resolve();
      writeStarted.resolve();
      return releaseWrite.promise;
    };
    const networkStarted = new Deferred<void>();
    const response = new Deferred<{ status: number; body: unknown }>();
    transport.enqueue(() => {
      networkStarted.resolve();
      return response.promise;
    });
    const trackedTransport: Transport<AbortSignalPort> = {
      request: (request) => {
        if (request.path === '/api/oauth/token') runtime.lastOAuthTokenSentAt = 1000;
        return transport.request(request);
      },
    };
    const client = createApiClient(trackedTransport);
    const coordinator = createRefreshCoordinator(runtime, client, client);
    const refreshing = coordinator.refresh();
    await networkStarted.promise;
    response.resolve(oauthTokenReply('access-after-refresh', 'refresh-after-refresh'));
    await writeStarted.promise;
    runtime.dispose();
    releaseWrite.resolve();

    await expect(refreshing).rejects.toBeInstanceOf(AuthSessionError);

    expect(transport.sent.filter(({ path }) => path === '/api/oauth/revoke')).toHaveLength(0);
    expect(ports.credentials.value).toContain('refresh-after-refresh');
    expect(ports.credentials.value).not.toContain('"refreshInFlight":true');
    expect(ports.timer.pending).toBe(0);
  });

  it('revokes the late rotated token when its record cannot be stored', async () => {
    const transport = new ScriptedTransport();
    const ports = testPorts(transport);
    const runtime = new AuthRuntime(CONFIG, ports);
    const previous: RuntimeTokens = {
      accessToken: 'access-before-refresh',
      refreshToken: 'refresh-before-refresh',
      expiresAt: 0,
      version: 1,
      lineageId: 'refresh-write-lineage',
    };
    runtime.installDigest = INSTALL_DIGEST;
    runtime.tokens = previous;
    runtime.record = makeRefreshRecord(runtime, INSTALL_DIGEST, previous);
    runtime.lastOAuthTokenSentAt = 1000;
    runtime.setState('signedIn', 'none');
    ports.credentials.value = JSON.stringify(runtime.record);

    const writeStarted = new Deferred<void>();
    const releaseWrite = new Deferred<void>();
    const writeRejected = new Deferred<void>();
    ports.credentials.beforeReplace = (value) => {
      if (!value.includes('refresh-after-refresh')) return Promise.resolve();
      writeStarted.resolve();
      return releaseWrite.promise.then(() => {
        writeRejected.resolve();
        return Promise.reject(new Error('credential store unavailable'));
      });
    };
    const networkStarted = new Deferred<void>();
    const response = new Deferred<{ status: number; body: unknown }>();
    transport.enqueue(() => {
      networkStarted.resolve();
      return response.promise;
    });
    const trackedTransport: Transport<AbortSignalPort> = {
      request: (request) => {
        if (request.path === '/api/oauth/token') runtime.lastOAuthTokenSentAt = 1000;
        return transport.request(request);
      },
    };
    const client = createApiClient(trackedTransport);
    const coordinator = createRefreshCoordinator(runtime, client, client);
    const refreshing = coordinator.refresh();
    await networkStarted.promise;
    response.resolve(oauthTokenReply('access-after-refresh', 'refresh-after-refresh'));
    await writeStarted.promise;
    runtime.dispose();
    releaseWrite.resolve();

    await expect(refreshing).rejects.toBeInstanceOf(AuthSessionError);
    await writeRejected.promise;

    expect(transport.sent.filter(({ path }) => path === '/api/oauth/revoke')).toHaveLength(1);
    expect(transport.sent.find(({ path }) => path === '/api/oauth/revoke')?.body).toMatchObject({
      token: 'refresh-after-refresh',
    });
    expect(ports.credentials.events.filter((event) => event === 'read')).toHaveLength(2);
    expect(ports.credentials.value).toContain('"refreshInFlight":true');
    expect(runtime.snapshot).toMatchObject({ status: 'signedOut', operation: 'none' });
    expect(ports.timer.pending).toBe(0);
  });

  it.each([
    ['fails once', false, 'once'],
    ['fails once', true, 'once'],
    ['always fails', false, 'always'],
    ['always fails', true, 'always'],
    ['times out without landing', false, 'never'],
    ['times out without landing', true, 'never'],
  ] as const)(
    'revokes an unowned late token when the write %s and reads are serialized=%s',
    async (_description, serialized, failure) => {
      const transport = new ScriptedTransport();
      transport.respond = async ({ path }) => {
        if (path === '/api/oauth/revoke') return { status: 200, body: {} };
        throw new Error(`Unexpected request: ${path}`);
      };
      const ports = testPorts(transport);
      ports.credentials.serializedOperations = serialized;
      const runtime = new AuthRuntime(CONFIG, ports);
      const previous: RuntimeTokens = {
        accessToken: 'access-before-refresh',
        refreshToken: 'refresh-before-refresh',
        expiresAt: 0,
        version: 1,
        lineageId: 'refresh-write-lineage',
      };
      runtime.installDigest = INSTALL_DIGEST;
      runtime.tokens = previous;
      runtime.record = {
        ...makeRefreshRecord(runtime, INSTALL_DIGEST, previous),
        refreshInFlight: true,
      };
      ports.credentials.value = JSON.stringify(runtime.record);
      runtime.setState('signedIn', 'refreshing');
      runtime.dispose();

      const writeStarted = new Deferred<void>();
      const neverLands = new Deferred<void>();
      let attempts = 0;
      ports.credentials.beforeReplace = async (value) => {
        if (!value.includes('refresh-after-refresh')) return;
        attempts += 1;
        writeStarted.resolve();
        if (failure === 'never') await neverLands.promise;
        if (failure === 'always' || (failure === 'once' && attempts === 1))
          throw new Error('rotated write failed');
      };

      let finished = false;
      const completion = new Deferred<void>();
      let timerScheduled = new Deferred<void>();
      ports.timer.onSchedule = () => timerScheduled.resolve();
      const completed = persistRotatedSessionAfterDispose(
        runtime,
        createApiClient(runtime.rawTransport),
        INSTALL_DIGEST,
        'refresh-before-refresh',
        {
          accessToken: 'access-after-refresh',
          refreshToken: 'refresh-after-refresh',
          lineageId: 'refresh-write-lineage',
        },
      );
      void completed.then(
        () => {
          finished = true;
          completion.resolve();
        },
        () => {
          finished = true;
          completion.resolve();
        },
      );
      await writeStarted.promise;

      if (failure === 'never') {
        let timerEvents = 0;
        while (!finished && timerEvents < 12) {
          let delay = ports.timer.pendingDelays[0];
          if (delay === undefined) {
            await Promise.race([timerScheduled.promise, completion.promise]);
            if (finished) break;
            delay = ports.timer.pendingDelays[0];
          }
          if (delay === undefined) throw new Error('Expected a deadline while storage was pending');
          timerScheduled = new Deferred<void>();
          ports.timer.fireDelay(delay);
          timerEvents += 1;
        }
      }
      await completed;

      const wasSaved = ports.credentials.value?.includes('refresh-after-refresh') ?? false;
      const revoked = revokedTokens(transport);
      expect(wasSaved).toBe(false);
      expect(revoked).toEqual(['refresh-after-refresh']);
      expect(ports.timer.pending).toBe(0);
    },
  );
});
