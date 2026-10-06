import { createApiClient } from '@app/sdk';
import type { Transport } from '@app/sdk';
import { describe, expect, it } from 'vitest';
import { PROFILE_READ_TIMEOUT_MS } from '../src/constants';
import type { AbortSignalPort } from '../src';
import { createCallbackProcessor } from '../src/callback-processing';
import { makeRecord } from '../src/persistence';
import { AuthRuntime } from '../src/runtime';
import type { AuthTransaction } from '../src/types/record';
import { revokedTokens } from './tracking';
import { watchTimerDrain } from './timer-drain';
import {
  CONFIG,
  Deferred,
  ScriptedTransport,
  oauthTokenReply,
  successUserReply,
  testPorts,
} from './support';

const INSTALL_DIGEST = 'callback-dispose-install';
const REFRESH_TOKEN = 'late-refresh';
const DISPOSE_GAP_AFTER_TOKEN_RESPONSE = 5;
const TRANSACTION: AuthTransaction = {
  verifier: 'verifier',
  state: 'callback-state',
  returnAddress: CONFIG.redirectUri,
  createdAt: 1_800_000_000_000,
  expiresAt: 1_800_000_300_000,
  operationId: 'callback-operation',
};

describe('callback results during disposal', () => {
  it('keeps an exchanged token whose record write lands after disposal', async () => {
    const { runtime, processor, ports, transport } = fixture();
    const writeStarted = new Deferred<void>();
    const releaseWrite = new Deferred<void>();
    const timersDrained = watchTimerDrain(ports.timer);
    ports.credentials.beforeReplace = async (value) => {
      if (!value.includes(`"refreshToken":"${REFRESH_TOKEN}"`)) return;
      writeStarted.resolve();
      await releaseWrite.promise;
    };
    const pending = processor.processAddress(callbackAddress());

    await writeStarted.promise;
    runtime.dispose();
    releaseWrite.resolve();
    expect((await pending).kind).toBe('signedOut');
    await runtime.writeTail;
    await timersDrained();

    const saved = ports.credentials.value?.includes(REFRESH_TOKEN) ?? false;
    const revoked = revokedTokens(transport).filter((token) => token === REFRESH_TOKEN).length;
    expect(saved).toBe(true);
    expect(revoked).toBe(0);
    expect(ports.timer.pending).toBe(0);
  });

  it('revokes a token when its disposed session write rejects before committing', async () => {
    const { runtime, processor, ports, transport } = fixture();
    const writeStarted = new Deferred<void>();
    const releaseWrite = new Deferred<void>();
    ports.credentials.beforeReplace = async (value) => {
      if (!value.includes(`"refreshToken":"${REFRESH_TOKEN}"`)) return;
      writeStarted.resolve();
      await releaseWrite.promise;
      throw new Error('storage rejected the exchanged session');
    };
    const pending = processor.processAddress(callbackAddress());
    await writeStarted.promise;
    runtime.dispose();
    releaseWrite.resolve();

    expect((await pending).kind).toBe('signedOut');
    await runtime.writeTail;

    expect(ports.credentials.value).toBeUndefined();
    expect(revokedTokens(transport)).toEqual([REFRESH_TOKEN]);
    expect(ports.timer.pending).toBe(0);
  });

  it('sends one revoke when disposal races the exchange continuation', async () => {
    const { runtime, processor, ports, transport } = fixture();
    const revokeReturned = new Deferred<void>();
    let scheduled = false;
    transport.onResponse = (request) => {
      if (request.path === '/api/oauth/revoke') revokeReturned.resolve();
      if (request.path !== '/api/oauth/token' || scheduled) return;
      scheduled = true;
      void (async () => {
        for (let index = 0; index < DISPOSE_GAP_AFTER_TOKEN_RESPONSE; index += 1)
          await Promise.resolve();
        runtime.dispose();
      })();
    };
    const timersDrained = watchTimerDrain(ports.timer);

    const outcome = await processor.processAddress(callbackAddress());
    await revokeReturned.promise;
    await runtime.writeTail;
    await timersDrained();

    expect(outcome.kind).toBe('signedOut');
    expect(revokedTokens(transport)).toEqual([REFRESH_TOKEN]);
    expect(ports.credentials.value).toBeUndefined();
    expect(ports.timer.pending).toBe(0);
  });

  it('sends one revoke when disposal follows the held exchange response by five microtasks', async () => {
    const { runtime, processor, ports, transport } = fixture();
    const exchangeResponseReady = new Deferred<void>();
    const releaseExchangeResponse = new Deferred<void>();
    const timersDrained = watchTimerDrain(ports.timer);
    transport.respond = async ({ path }) => {
      if (path === '/api/oauth/token') {
        exchangeResponseReady.resolve();
        await releaseExchangeResponse.promise;
        return oauthTokenReply('late-access', REFRESH_TOKEN);
      }
      if (path === '/api/oauth/revoke') return { status: 200, body: {} };
      if (path === '/api/user/profile') return successUserReply();
      throw new Error(`Unexpected request: ${path}`);
    };

    const pending = processor.processAddress(callbackAddress());
    await exchangeResponseReady.promise;
    releaseExchangeResponse.resolve();
    for (let index = 0; index < DISPOSE_GAP_AFTER_TOKEN_RESPONSE; index += 1)
      await Promise.resolve();
    runtime.dispose();

    expect((await pending).kind).toBe('signedOut');
    await runtime.writeTail;
    await timersDrained();
    expect(revokedTokens(transport)).toEqual([REFRESH_TOKEN]);
    expect(ports.credentials.value).toBeUndefined();
    expect(ports.timer.pending).toBe(0);
  });

  it('keeps a persisted token when disposal lands after a successful profile response', async () => {
    let profileResponseReturned = false;
    let disposeProfileRead: () => void = () => undefined;
    const { runtime, processor, ports, transport } = fixture(() => {
      profileResponseReturned = true;
    });
    const profileSettled = new Deferred<void>();
    disposeProfileRead = () => {
      runtime.dispose();
      profileSettled.resolve();
    };
    const timersDrained = watchTimerDrain(ports.timer, {
      onCancel: (milliseconds) => {
        if (milliseconds === PROFILE_READ_TIMEOUT_MS && profileResponseReturned)
          disposeProfileRead();
      },
    });

    const result = await processor.processAddress(callbackAddress());
    await profileSettled.promise;
    await timersDrained();

    expect(result.kind).toBe('signedOut');
    expect(revokedTokens(transport)).toEqual([]);
    expect(ports.credentials.value).toContain(REFRESH_TOKEN);
    expect(ports.timer.pending).toBe(0);
  });
});

function fixture(afterProfileResponse?: () => void) {
  const transport = new ScriptedTransport();
  transport.respond = async ({ path }) => {
    if (path === '/api/oauth/token') return oauthTokenReply('late-access', REFRESH_TOKEN);
    if (path === '/api/user/profile') return successUserReply();
    if (path === '/api/oauth/revoke') return { status: 200, body: {} };
    throw new Error(`Unexpected request: ${path}`);
  };
  const ports = testPorts(transport);
  const runtime = new AuthRuntime(CONFIG, ports);
  runtime.installDigest = INSTALL_DIGEST;
  runtime.record = { ...makeRecord(CONFIG, INSTALL_DIGEST), transaction: TRANSACTION };
  runtime.setState('signedOut', 'none');
  ports.credentials.value = JSON.stringify(runtime.record);
  const observedTransport: Transport<AbortSignalPort> = {
    request: async (request) => {
      const response = await runtime.rawTransport.request(request);
      if (request.path === '/api/user/profile') afterProfileResponse?.();
      return response;
    },
  };
  const client = createApiClient(observedTransport);
  const processor = createCallbackProcessor(runtime, client, client);
  return { runtime, processor, ports, transport };
}

function callbackAddress(): string {
  return `${CONFIG.redirectUri}?code=authorization-code&state=${TRANSACTION.state}`;
}
