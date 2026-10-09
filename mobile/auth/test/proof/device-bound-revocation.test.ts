import { describe, expect, it } from 'vitest';
import { createAuthEngine } from '../support/engine';
import {
  dpopTokenReply,
  establishBoundSession,
  requestPayload,
} from '../support/device-bound-support';
import { SoftwareDeviceKey } from '../support/software-device-key';
import {
  CONFIG,
  REFRESH_TOKEN,
  ScriptedTransport,
  acceptCode,
  failedApiReply,
  testPorts,
} from '../support/support';
import { revokedTokens } from '../support/tracking';

describe('device-bound revocation', () => {
  it('revokes with a proof and retries one nonce challenge with a fresh proof', async () => {
    const { engine, transport } = await establishBoundSession();
    transport.enqueue(
      {
        status: 400,
        body: { error: 'use_dpop_nonce' },
        headers: { 'DPoP-Nonce': 'revoke-nonce' },
      },
      { status: 200, body: { access_token: 'unused' } },
    );

    const outcome = await engine.signOut();

    const revokeRequests = transport.sent.filter(({ path }) => path === '/api/oauth/revoke');
    expect(outcome.kind).toBe('signedOut');
    expect(outcome.kind === 'signedOut' ? outcome.revocation : undefined).toBe('revoked');
    expect(revokeRequests).toHaveLength(2);
    expect(revokedTokens(transport)).toEqual([REFRESH_TOKEN, REFRESH_TOKEN]);
    expect(requestPayload(revokeRequests[0]?.headers?.DPoP ?? '').ath).toEqual(expect.any(String));
    expect(requestPayload(revokeRequests[1]?.headers?.DPoP ?? '').nonce).toBe('revoke-nonce');
    expect(requestPayload(revokeRequests[0]?.headers?.DPoP ?? '').jti).not.toBe(
      requestPayload(revokeRequests[1]?.headers?.DPoP ?? '').jti,
    );
  });

  it('uses the binding proof when a profile failure revokes an exchanged session', async () => {
    const transport = new ScriptedTransport();
    const ports = testPorts(transport, new SoftwareDeviceKey());
    transport.enqueue(dpopTokenReply(), failedApiReply(500, 'PROFILE_FAILURE'), {
      status: 200,
      body: {},
    });
    acceptCode(ports.authBrowser, 'profile-failure-code');
    const engine = createAuthEngine(CONFIG, ports);
    await engine.restore();

    const outcome = await engine.signIn();
    const profile = transport.sent.find(({ path }) => path === '/api/user/profile');
    const revoke = transport.sent.find(({ path }) => path === '/api/oauth/revoke');

    expect(outcome.kind).toBe('apiFailure');
    expect(profile?.headers?.DPoP).toBeUndefined();
    expect(revoke?.headers?.DPoP).toEqual(expect.any(String));
    expect(revokedTokens(transport)).toEqual([REFRESH_TOKEN]);
  });
});
