import { describe, expect, it } from 'vitest';
import { Buffer } from 'node:buffer';
import { createAuthEngine } from './engine';
import { dpopTokenReply } from './device-bound-support';
import { SoftwareDeviceKey } from './software-device-key';
import { CONFIG, ScriptedTransport, acceptCode, successUserReply, testPorts } from './support';

function payloadOf(proof: string): Record<string, unknown> {
  const payload = proof.split('.')[1] ?? '';
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>;
}

describe('device-bound code exchange', () => {
  it('sends a proof and saves the binding thumbprint with the session', async () => {
    const transport = new ScriptedTransport();
    const ports = testPorts(transport, new SoftwareDeviceKey());
    transport.enqueue(dpopTokenReply(), successUserReply());
    acceptCode(ports.authBrowser, 'bound-code');
    const engine = createAuthEngine(CONFIG, ports);
    await engine.restore();

    const outcome = await engine.signIn();
    const exchange = transport.sent.find(({ path }) => path === '/api/oauth/token');
    const proof = exchange?.headers?.DPoP;

    expect(outcome.kind).toBe('signedIn');
    expect(proof).toEqual(expect.any(String));
    expect(payloadOf(proof ?? '').htm).toBe('POST');
    expect(payloadOf(proof ?? '').htu).toBe('https://api.example.test/api/oauth/token');
    expect(payloadOf(proof ?? '').ath).toBeUndefined();
    expect(ports.credentials.value).toContain('"proofKeyThumbprint"');
    expect(ports.credentials.value).toContain('"lineageId"');
  });

  it('retries one nonce challenge with the same code and a fresh proof id', async () => {
    const transport = new ScriptedTransport();
    const ports = testPorts(transport, new SoftwareDeviceKey());
    transport.enqueue(
      { status: 400, body: { error: 'use_dpop_nonce' }, headers: { 'DPoP-Nonce': 'server-nonce' } },
      dpopTokenReply(),
      successUserReply(),
    );
    acceptCode(ports.authBrowser, 'nonce-code');
    const engine = createAuthEngine(CONFIG, ports);
    await engine.restore();

    const outcome = await engine.signIn();
    const requests = transport.sent.filter(({ path }) => path === '/api/oauth/token');
    const firstBody = requests[0]?.body;
    const secondBody = requests[1]?.body;

    expect(outcome.kind).toBe('signedIn');
    expect(requests).toHaveLength(2);
    expect(firstBody).toEqual(secondBody);
    expect(payloadOf(requests[1]?.headers?.DPoP ?? '').nonce).toBe('server-nonce');
    expect(payloadOf(requests[0]?.headers?.DPoP ?? '').jti).not.toBe(
      payloadOf(requests[1]?.headers?.DPoP ?? '').jti,
    );
  });

  it('stops after a second nonce challenge', async () => {
    const transport = new ScriptedTransport();
    const ports = testPorts(transport, new SoftwareDeviceKey());
    transport.enqueue(
      { status: 400, body: { error: 'use_dpop_nonce' }, headers: { 'DPoP-Nonce': 'nonce-1' } },
      { status: 400, body: { error: 'use_dpop_nonce' }, headers: { 'DPoP-Nonce': 'nonce-2' } },
    );
    acceptCode(ports.authBrowser, 'loop-code');
    const engine = createAuthEngine(CONFIG, ports);
    await engine.restore();

    const outcome = await engine.signIn();

    expect(outcome.kind).toBe('oauthFailure');
    expect(transport.sent.filter(({ path }) => path === '/api/oauth/token')).toHaveLength(2);
    expect(ports.credentials.value).toBeUndefined();
  });
});
