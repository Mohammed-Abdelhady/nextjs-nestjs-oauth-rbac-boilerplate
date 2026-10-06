import { describe, expect, it } from 'vitest';
import { ApiError, HTTP_METHOD, TRANSPORT_FAILURE } from '@app/sdk';
import { createAuthEngine } from './engine';
import { CONFIG, ScriptedTransport, establishSession, failedApiReply, testPorts } from './support';

describe('refresh response classification', () => {
  it('keeps the grant after a bodyless rate limit response', async () => {
    const transport = new ScriptedTransport();
    const ports = testPorts(transport);
    const engine = createAuthEngine(CONFIG, ports);
    await establishSession(engine, ports, transport);
    ports.clock.advance(270_000);
    transport.enqueue({ status: 429, body: undefined });

    await expect(
      engine.transport.request({ method: HTTP_METHOD.GET, path: '/api/user/profile' }),
    ).rejects.toMatchObject({ status: 429, code: 'RATE_LIMIT_EXCEEDED' });

    expect(engine.snapshot).toMatchObject({ status: 'signedIn', operation: 'none' });
    expect(ports.credentials.value).not.toContain('"refreshInFlight":true');
  });

  it.each([
    [500, 'AUTHORITY_UNAVAILABLE', 'reauthRequired'],
    [429, 'AUTHORITY_UNAVAILABLE', 'reauthRequired'],
    [500, 'RATE_LIMIT_EXCEEDED', 'reauthRequired'],
    [503, 'TRANSACTION_OUTCOME_UNKNOWN', 'reauthRequired'],
    [503, 'AUTHORITY_UNAVAILABLE', 'signedIn'],
  ] as const)(
    'requires reauthentication only for unknown outcomes: %i %s',
    async (status, code, expected) => {
      const transport = new ScriptedTransport();
      const ports = testPorts(transport);
      const engine = createAuthEngine(CONFIG, ports);
      await establishSession(engine, ports, transport);
      ports.clock.advance(270_000);
      transport.enqueue(failedApiReply(status, code));

      await expect(
        engine.transport.request({ method: HTTP_METHOD.GET, path: '/api/user/profile' }),
      ).rejects.toBeInstanceOf(ApiError);

      expect(engine.snapshot.status).toBe(expected);
      expect(ports.credentials.value?.includes('"refreshInFlight":true')).toBe(
        expected === 'reauthRequired',
      );
      if (expected === 'reauthRequired') {
        expect(engine.snapshot.reason).toBe('refreshInterrupted');
        expect(transport.sent.filter(({ path }) => path === '/api/oauth/token')).toHaveLength(2);
      } else {
        expect(engine.snapshot.operation).toBe('none');
      }
    },
  );

  it('does not report a pre-aborted request as an unknown rotation', async () => {
    const transport = new ScriptedTransport();
    const ports = testPorts(transport);
    const engine = createAuthEngine(CONFIG, ports);
    await establishSession(engine, ports, transport);
    ports.clock.advance(270_000);
    const signal = {
      aborted: true,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    };

    await expect(
      engine.transport.request({ method: HTTP_METHOD.GET, path: '/api/user/profile', signal }),
    ).rejects.toMatchObject({ reason: TRANSPORT_FAILURE.ABORTED });
    expect(engine.snapshot.status).toBe('signedIn');
  });
});
