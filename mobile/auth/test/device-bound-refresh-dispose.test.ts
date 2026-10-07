import { describe, expect, it } from 'vitest';
import { TransportError, TRANSPORT_FAILURE } from '@app/sdk';
import { AuthDisposedError as EngineDisposedError } from '../src/errors';
import { parseStoredRecord } from '../src/persistence';
import { Deferred, apiReply } from './support';
import { establishBoundSession, refreshRequests } from './device-bound-support';
import { allowBoundRefreshReplayAfterUnknownOutcome, revokedTokens } from './tracking';

function isRefreshRequest(request: { path: string; body?: unknown }): boolean {
  return (
    request.path === '/api/oauth/token' &&
    typeof request.body === 'object' &&
    request.body !== null &&
    'grant_type' in request.body &&
    request.body.grant_type === 'refresh_token'
  );
}

describe('device-bound refresh disposal', () => {
  it('does not start the one replacement when disposal precedes the lost answer', async () => {
    const { engine, ports, transport, deviceKey } = await establishBoundSession();
    ports.clock.advance(270_000);
    const refreshStarted = new Deferred<void>();
    const lostAnswer = new Deferred<never>();
    const deadlineCancelled = new Deferred<void>();
    ports.timer.onCancel = (milliseconds) => {
      if (milliseconds === 15_000) deadlineCancelled.resolve();
    };
    transport.respond = async (request) => {
      if (isRefreshRequest(request)) {
        refreshStarted.resolve();
        return lostAnswer.promise;
      }
      return apiReply({ id: 'profile' });
    };
    const request = engine.transport.request({ method: 'GET', path: '/api/user/profile' });
    await refreshStarted.promise;
    engine.dispose();
    await expect(request).rejects.toBeInstanceOf(EngineDisposedError);
    lostAnswer.reject(new TransportError(TRANSPORT_FAILURE.NO_RESPONSE));
    await deadlineCancelled.promise;

    expect(refreshRequests(transport)).toHaveLength(1);
    expect(deviceKey.signed).toHaveLength(2);
    expect(revokedTokens(transport)).toEqual([]);
    expect(parseStoredRecord(ports.credentials.value ?? '')?.refreshInFlight).toBe(true);
  });

  it('saves a late successful replacement when disposal lands during the retry', async () => {
    const { engine, ports, transport } = await establishBoundSession();
    const retryStarted = new Deferred<void>();
    const lateAnswer = new Deferred<{ status: number; body: unknown }>();
    const replacementSaved = new Deferred<void>();
    ports.credentials.afterReplace = (value) => {
      const record = parseStoredRecord(value);
      if (record?.tokens?.refreshToken === 'refresh-1' && !record.refreshInFlight)
        replacementSaved.resolve();
    };
    ports.clock.advance(270_000);
    allowBoundRefreshReplayAfterUnknownOutcome('refresh-secret-0');
    let refreshAttempt = 0;
    transport.respond = async (request) => {
      if (isRefreshRequest(request)) {
        refreshAttempt += 1;
        if (refreshAttempt === 1) throw new TransportError(TRANSPORT_FAILURE.NO_RESPONSE);
        retryStarted.resolve();
        return lateAnswer.promise;
      }
      return apiReply({ id: 'profile' });
    };
    const request = engine.transport.request({ method: 'GET', path: '/api/user/profile' });
    await retryStarted.promise;
    engine.dispose();
    await expect(request).rejects.toBeInstanceOf(EngineDisposedError);
    lateAnswer.resolve({
      status: 200,
      body: {
        access_token: 'access-1',
        token_type: 'DPoP',
        expires_in: 300,
        refresh_token: 'refresh-1',
        scope: 'api',
      },
    });
    await replacementSaved.promise;

    expect(refreshRequests(transport)).toHaveLength(2);
    expect(parseStoredRecord(ports.credentials.value ?? '')?.tokens?.refreshToken).toBe(
      'refresh-1',
    );
    expect(parseStoredRecord(ports.credentials.value ?? '')?.refreshInFlight).toBeUndefined();
    expect(revokedTokens(transport)).toEqual([]);
    expect(engine.snapshot.status).toBe('signedOut');
  });
});
