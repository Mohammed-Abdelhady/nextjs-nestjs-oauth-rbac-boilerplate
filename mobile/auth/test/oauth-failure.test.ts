import { describe, expect, it } from 'vitest';
import { HTTP_METHOD, OAuthError } from '@app/sdk';
import { createAuthEngine } from './engine';
import { CONFIG, ScriptedTransport, acceptCode, establishSession, testPorts } from './support';

const OAUTH_FAILURES = [
  {
    name: 'disabled',
    body: { error: 'unauthorized_client', error_description: 'NATIVE_AUTH_DISABLED' },
    outcome: 'disabled',
    reason: 'disabled',
    refreshStatus: 'signedOut',
    refreshReason: 'disabled',
    record: 'deleted',
  },
  {
    name: 'ordinary unauthorized client',
    body: { error: 'unauthorized_client' },
    outcome: 'oauthFailure',
    reason: 'oauthFailure',
    refreshStatus: 'reauthRequired',
    refreshReason: 'refreshInterrupted',
    record: 'marked',
  },
  {
    name: 'invalid grant with the disabled description',
    body: { error: 'invalid_grant', error_description: 'NATIVE_AUTH_DISABLED' },
    outcome: 'oauthFailure',
    reason: 'oauthFailure',
    refreshStatus: 'signedOut',
    refreshReason: 'oauthFailure',
    record: 'deleted',
  },
] as const;

describe('OAuth failure classification', () => {
  it.each(OAUTH_FAILURES)('maps $name during sign-in', async ({ body, outcome, reason }) => {
    const transport = new ScriptedTransport();
    transport.enqueue({ status: 400, body });
    const ports = testPorts(transport);
    acceptCode(ports.authBrowser);
    const engine = createAuthEngine(CONFIG, ports);
    await engine.restore();

    const result = await engine.signIn();

    expect(result.kind).toBe(outcome);
    expect(engine.snapshot.reason).toBe(reason);
    expect(ports.credentials.value).toBeUndefined();
  });

  it.each(OAUTH_FAILURES)(
    'maps $name during refresh',
    async ({ body, refreshStatus, refreshReason, record }) => {
      const transport = new ScriptedTransport();
      const ports = testPorts(transport);
      const engine = createAuthEngine(CONFIG, ports);
      await establishSession(engine, ports, transport);
      ports.clock.advance(270_000);
      transport.enqueue({ status: 400, body });

      await expect(
        engine.transport.request({ method: HTTP_METHOD.GET, path: '/api/user/profile' }),
      ).rejects.toBeInstanceOf(OAuthError);

      expect(engine.snapshot.status).toBe(refreshStatus);
      expect(engine.snapshot.reason).toBe(refreshReason);
      if (record === 'deleted') expect(ports.credentials.value).toBeUndefined();
      else expect(ports.credentials.value).toContain('"refreshInFlight":true');
    },
  );
});
