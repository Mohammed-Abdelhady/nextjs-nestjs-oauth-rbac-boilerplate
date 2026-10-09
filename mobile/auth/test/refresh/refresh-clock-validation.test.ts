import { HTTP_METHOD } from '@app/sdk';
import { describe, expect, it } from 'vitest';
import { createAuthEngine } from '../support/engine';
import {
  CONFIG,
  Deferred,
  ScriptedTransport,
  establishSession,
  oauthTokenReply,
  successUserReply,
  testPorts,
} from '../support/support';

describe('refresh clock validation', () => {
  it('does not send or replay a refresh when the send timestamp is not finite', async () => {
    const transport = new ScriptedTransport();
    const ports = testPorts(transport);
    const engine = createAuthEngine(CONFIG, ports);
    await establishSession(engine, ports, transport);
    transport.sent.length = 0;
    ports.clock.advance(270_000);
    let invalidClock = false;
    const refreshStarted = new Deferred<void>();
    transport.respond = async ({ path, body }) => {
      if (path === '/api/oauth/token') {
        if (
          typeof body === 'object' &&
          body !== null &&
          'grant_type' in body &&
          body.grant_type === 'refresh_token'
        )
          refreshStarted.resolve();
        return oauthTokenReply('rotated-access', 'rotated-refresh');
      }
      return successUserReply();
    };
    ports.credentials.afterReplace = (value) => {
      if (value.includes('"refreshInFlight":true')) invalidClock = true;
    };
    const originalMonotonic = ports.clock.monotonicTime.bind(ports.clock);
    ports.clock.monotonicTime = () => (invalidClock ? Number.NaN : originalMonotonic());

    const request = engine.transport.request({
      method: HTTP_METHOD.GET,
      path: '/api/user/profile',
    });
    const sendDecision = await Promise.race([
      refreshStarted.promise.then(() => 'sent' as const),
      request.then(
        () => 'completed' as const,
        () => 'rejected' as const,
      ),
    ]);

    expect(sendDecision).toBe('rejected');
    await expect(request).rejects.toMatchObject({ name: 'AuthPortError' });
    expect(
      transport.sent.filter(
        ({ path, body }) =>
          path === '/api/oauth/token' &&
          typeof body === 'object' &&
          body !== null &&
          'grant_type' in body &&
          body.grant_type === 'refresh_token',
      ),
    ).toHaveLength(0);
    expect(engine.snapshot).toMatchObject({ status: 'signedIn', operation: 'none' });
    ports.clock.monotonicTime = originalMonotonic;
    engine.dispose();
  });
});
