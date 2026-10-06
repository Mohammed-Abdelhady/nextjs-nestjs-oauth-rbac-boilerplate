import { HTTP_METHOD, TRANSPORT_FAILURE } from '@app/sdk';
import { describe, expect, it } from 'vitest';
import { PortAbortController } from '../src/abort-controller';
import { REFRESH_THROTTLE_BACKOFF_MS } from '../src/constants';
import { allowRefreshReplayAfterThrottle } from './tracking';
import { createAuthEngine } from './engine';
import {
  CONFIG,
  Deferred,
  REFRESH_TOKEN,
  ScriptedTransport,
  apiReply,
  establishSession,
  failedApiReply,
  oauthTokenReply,
  testPorts,
} from './support';

describe('independent aborts during a shared refresh backoff', () => {
  it('starts a fresh shared wait when the last waiter aborts before another request arrives', async () => {
    const transport = new ScriptedTransport();
    const ports = testPorts(transport);
    const engine = createAuthEngine(CONFIG, ports);
    await establishSession(engine, ports, transport);
    ports.clock.advance(270_000);
    transport.enqueue(failedApiReply(429, 'RATE_LIMIT_EXCEEDED'));
    await expect(
      engine.transport.request({ method: HTTP_METHOD.GET, path: '/api/user/profile' }),
    ).rejects.toMatchObject({ status: 429 });
    allowRefreshReplayAfterThrottle(REFRESH_TOKEN);

    const firstWait = new Deferred<void>();
    const nextWait = new Deferred<void>();
    let schedules = 0;
    ports.timer.onSchedule = (milliseconds) => {
      if (milliseconds !== REFRESH_THROTTLE_BACKOFF_MS) return;
      schedules += 1;
      if (schedules === 1) firstWait.resolve();
      if (schedules === 2) nextWait.resolve();
    };
    transport.enqueue(oauthTokenReply('fresh-access', 'fresh-refresh'), apiReply({}));
    const controller = new PortAbortController();
    const abandoned = engine.transport.request({
      method: HTTP_METHOD.GET,
      path: '/api/user/profile',
      signal: controller.signal,
    });
    await firstWait.promise;
    controller.abort();
    await expect(abandoned).rejects.toMatchObject({ reason: TRANSPORT_FAILURE.ABORTED });
    const next = engine.transport.request({ method: HTTP_METHOD.GET, path: '/api/user/profile' });
    const arrival = await Promise.race([
      nextWait.promise.then(() => 'waiting' as const),
      next.then(
        () => 'settled' as const,
        () => 'settled' as const,
      ),
    ]);

    expect(arrival).toBe('waiting');
    ports.clock.advance(REFRESH_THROTTLE_BACKOFF_MS);
    ports.timer.fireDelay(REFRESH_THROTTLE_BACKOFF_MS);
    await expect(next).resolves.toMatchObject({ status: 200 });
    expect(
      transport.sent.filter(
        ({ path, body }) =>
          path === '/api/oauth/token' &&
          typeof body === 'object' &&
          body !== null &&
          'grant_type' in body &&
          body.grant_type === 'refresh_token',
      ),
    ).toHaveLength(2);
    engine.dispose();
  });

  it('keeps the other waiter and shared timer when one caller aborts', async () => {
    const transport = new ScriptedTransport();
    const ports = testPorts(transport);
    const engine = createAuthEngine(CONFIG, ports);
    await establishSession(engine, ports, transport);
    ports.clock.advance(270_000);
    transport.enqueue(failedApiReply(429, 'RATE_LIMIT_EXCEEDED'));
    await expect(
      engine.transport.request({ method: HTTP_METHOD.GET, path: '/api/user/profile' }),
    ).rejects.toMatchObject({ status: 429 });
    allowRefreshReplayAfterThrottle(REFRESH_TOKEN);
    const waitScheduled = new Deferred<void>();
    ports.timer.onSchedule = (milliseconds) => {
      if (milliseconds === REFRESH_THROTTLE_BACKOFF_MS) waitScheduled.resolve();
    };
    transport.enqueue(oauthTokenReply('after-backoff', 'after-backoff-refresh'), apiReply({}));
    const firstController = new PortAbortController();
    const first = engine.transport.request({
      method: HTTP_METHOD.GET,
      path: '/api/user/profile',
      signal: firstController.signal,
    });
    const second = engine.transport.request({
      method: HTTP_METHOD.GET,
      path: '/api/user/profile',
    });
    await waitScheduled.promise;

    firstController.abort();

    await expect(first).rejects.toMatchObject({ reason: TRANSPORT_FAILURE.ABORTED });
    expect(ports.timer.pendingDelays).toContain(REFRESH_THROTTLE_BACKOFF_MS);
    ports.clock.advance(REFRESH_THROTTLE_BACKOFF_MS);
    ports.timer.fireDelay(REFRESH_THROTTLE_BACKOFF_MS);
    await expect(second).resolves.toMatchObject({ status: 200 });

    const refreshes = transport.sent.filter(
      ({ path, body }) =>
        path === '/api/oauth/token' &&
        typeof body === 'object' &&
        body !== null &&
        'grant_type' in body &&
        body.grant_type === 'refresh_token',
    );
    expect(refreshes).toHaveLength(2);
    expect(ports.timer.pending).toBe(0);
    engine.dispose();
  });
});
