import { describe, expect, it } from 'vitest';
import { HTTP_METHOD, TransportError, TRANSPORT_FAILURE } from '@app/sdk';
import { parseStoredRecord } from '../src/persistence';
import {
  dpopTokenReply,
  establishBoundSession,
  refreshRequests,
  requestPayload,
} from './device-bound-support';
import {
  allowBoundRefreshReplayAfterUnknownOutcome,
  allowRefreshReplayAfterDpopNonce,
} from './tracking';
import { REFRESH_TOKEN, apiReply } from './support';

describe('device-bound refresh', () => {
  it('sends the token hash and keeps lineage and thumbprint across rotation', async () => {
    const { engine, ports, transport } = await establishBoundSession();
    const before = parseStoredRecord(ports.credentials.value ?? '');
    ports.clock.advance(270_000);
    transport.enqueue(dpopTokenReply('access-1', 'refresh-1'), apiReply({ id: 'profile' }));

    await engine.transport.request({ method: HTTP_METHOD.GET, path: '/api/user/profile' });

    const request = refreshRequests(transport)[0];
    const stored = parseStoredRecord(ports.credentials.value ?? '');
    const proof = request?.headers?.DPoP ?? '';
    expect(requestPayload(proof).ath).toEqual(expect.any(String));
    expect(requestPayload(proof).htu).toBe('https://api.example.test/api/oauth/token');
    expect(stored?.lineageId).toBe('BAQEBAQEBAQEBAQEBAQEBA');
    expect(stored?.lineageId).toBe(before?.lineageId);
    expect(stored?.proofKeyThumbprint).toBe(before?.proofKeyThumbprint);
    expect(stored?.tokens?.refreshToken).toBe('refresh-1');
  });

  it('retries one refresh nonce challenge with the same token and a new proof id', async () => {
    const { engine, ports, transport } = await establishBoundSession();
    ports.clock.advance(270_000);
    allowRefreshReplayAfterDpopNonce(REFRESH_TOKEN);
    transport.enqueue(
      {
        status: 400,
        body: { error: 'use_dpop_nonce' },
        headers: { 'DPoP-Nonce': 'refresh-nonce' },
      },
      dpopTokenReply('access-1', 'refresh-1'),
      apiReply({ id: 'profile' }),
    );

    await engine.transport.request({ method: HTTP_METHOD.GET, path: '/api/user/profile' });

    const [first, second] = refreshRequests(transport);
    expect(refreshRequests(transport)).toHaveLength(2);
    expect(first?.body).toEqual(second?.body);
    expect(requestPayload(first?.headers?.DPoP ?? '').jti).not.toBe(
      requestPayload(second?.headers?.DPoP ?? '').jti,
    );
    expect(requestPayload(second?.headers?.DPoP ?? '').nonce).toBe('refresh-nonce');
  });

  it('replays one unknown bound refresh with a fresh proof and saves the replacement', async () => {
    const { engine, ports, transport } = await establishBoundSession();
    const before = parseStoredRecord(ports.credentials.value ?? '');
    ports.clock.advance(270_000);
    allowBoundRefreshReplayAfterUnknownOutcome(REFRESH_TOKEN);
    transport.enqueue(
      new TransportError(TRANSPORT_FAILURE.NO_RESPONSE),
      dpopTokenReply('access-1', 'refresh-1'),
      apiReply({ id: 'profile' }),
    );

    await engine.transport.request({ method: HTTP_METHOD.GET, path: '/api/user/profile' });

    const requests = refreshRequests(transport);
    const stored = parseStoredRecord(ports.credentials.value ?? '');
    expect(requests).toHaveLength(2);
    expect(requests[0]?.body).toEqual(requests[1]?.body);
    expect(requestPayload(requests[0]?.headers?.DPoP ?? '').jti).not.toBe(
      requestPayload(requests[1]?.headers?.DPoP ?? '').jti,
    );
    expect(stored?.lineageId).toBe(before?.lineageId);
    expect(stored?.tokens?.refreshToken).toBe('refresh-1');
    expect(engine.snapshot.status).toBe('signedIn');
  });

  it('does not replay a lost answer for an unbound session', async () => {
    const { createAuthEngine } = await import('./engine');
    const { CONFIG, ScriptedTransport, testPorts, establishSession } = await import('./support');
    const transport = new ScriptedTransport();
    const ports = testPorts(transport);
    const engine = createAuthEngine(CONFIG, ports);
    await establishSession(engine, ports, transport);
    ports.clock.advance(270_000);
    transport.enqueue(new TransportError(TRANSPORT_FAILURE.NO_RESPONSE));

    await expect(
      engine.transport.request({ method: HTTP_METHOD.GET, path: '/api/user/profile' }),
    ).rejects.toBeInstanceOf(TransportError);

    expect(refreshRequests(transport)).toHaveLength(1);
    expect(engine.snapshot.status).toBe('reauthRequired');
  });
});
