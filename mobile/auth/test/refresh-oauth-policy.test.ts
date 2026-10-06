import { describe, expect, it } from 'vitest';
import { HTTP_METHOD, OAuthError } from '@app/sdk';
import { createAuthEngine } from './engine';
import { CONFIG, ScriptedTransport, establishSession, testPorts } from './support';

const REFRESH_FAILURES = [
  {
    name: 'invalid_grant',
    body: { error: 'invalid_grant' },
    status: 'signedOut',
    record: 'deleted',
  },
  {
    name: 'native auth disabled',
    body: { error: 'unauthorized_client', error_description: 'NATIVE_AUTH_DISABLED' },
    status: 'signedOut',
    record: 'deleted',
  },
  {
    name: 'invalid_client',
    body: { error: 'invalid_client' },
    status: 'signedOut',
    record: 'deleted',
  },
  {
    name: 'server_error',
    body: { error: 'server_error' },
    status: 'reauthRequired',
    record: 'marked',
  },
  {
    name: 'temporarily_unavailable',
    body: { error: 'temporarily_unavailable' },
    status: 'reauthRequired',
    record: 'marked',
  },
  {
    name: 'unknown OAuth error',
    body: { error: 'vendor_error' },
    status: 'reauthRequired',
    record: 'marked',
  },
] as const;

describe('refresh OAuth failure policy', () => {
  it.each(REFRESH_FAILURES)('applies the grant policy for $name', async (failure) => {
    const transport = new ScriptedTransport();
    const ports = testPorts(transport);
    const engine = createAuthEngine(CONFIG, ports);
    await establishSession(engine, ports, transport);
    ports.clock.advance(270_000);
    transport.enqueue({ status: 400, body: failure.body });

    await expect(
      engine.transport.request({ method: HTTP_METHOD.GET, path: '/api/user/profile' }),
    ).rejects.toBeInstanceOf(OAuthError);

    expect(engine.snapshot.status).toBe(failure.status);
    if (failure.record === 'deleted') {
      expect(ports.credentials.value).toBeUndefined();
    } else {
      expect(ports.credentials.value).toContain('"refreshInFlight":true');
    }
  });
});
