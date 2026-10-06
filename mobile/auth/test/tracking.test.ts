import { describe, expect, it } from 'vitest';
import { HTTP_METHOD } from '@app/sdk';
import {
  allowRefreshReplayAfterThrottle,
  assertNoRefreshTokenReplay,
  registerTransport,
  type ScriptedRequestLog,
} from './tracking';

describe('refresh replay test support', () => {
  it('detects a repeated refresh token across transport instances', () => {
    const beforeRestart: ScriptedRequestLog = { sent: [] };
    const afterRestart: ScriptedRequestLog = { sent: [] };
    const request = {
      method: HTTP_METHOD.POST,
      path: '/api/oauth/token',
      body: { grant_type: 'refresh_token', refresh_token: 'refresh-secret-0' },
    };
    beforeRestart.sent.push(request);
    afterRestart.sent.push(request);
    registerTransport(beforeRestart);
    registerTransport(afterRestart);

    expect(() => assertNoRefreshTokenReplay()).toThrow();
    allowRefreshReplayAfterThrottle('refresh-secret-0');
    expect(() => assertNoRefreshTokenReplay()).not.toThrow();
  });
});
