import { HTTP_METHOD } from '@app/sdk';
import { describe, expect, it } from 'vitest';
import { allowRefreshReplayAfterThrottle, assertNoRefreshTokenReplay } from '../support/tracking';
import { ScriptedTransport } from '../support/support';

describe('refresh replay tracking', () => {
  it('detects one refresh token repeated across simulated restarts', () => {
    const firstRun = new ScriptedTransport();
    const restartedRun = new ScriptedTransport();
    const refreshRequest = {
      method: HTTP_METHOD.POST,
      path: '/api/oauth/token',
      body: { grant_type: 'refresh_token', refresh_token: 'replayed-token' },
    };
    firstRun.sent.push(refreshRequest);
    restartedRun.sent.push(refreshRequest);

    expect(assertNoRefreshTokenReplay).toThrow();

    allowRefreshReplayAfterThrottle('replayed-token');
    expect(assertNoRefreshTokenReplay).not.toThrow();
  });
});
