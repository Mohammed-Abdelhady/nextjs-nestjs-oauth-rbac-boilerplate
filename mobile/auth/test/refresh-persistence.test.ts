import { describe, expect, it } from 'vitest';
import { HTTP_METHOD } from '@app/sdk';
import { createAuthEngine } from './engine';
import {
  CONFIG,
  ScriptedTransport,
  establishSession,
  oauthTokenReply,
  apiReply,
  testPorts,
} from './support';

describe('persisted refresh credentials', () => {
  it('stores the rotated refresh token but never the access token', async () => {
    const transport = new ScriptedTransport();
    const ports = testPorts(transport);
    const engine = createAuthEngine(CONFIG, ports);
    await establishSession(engine, ports, transport);
    ports.clock.advance(270_000);
    transport.enqueue(oauthTokenReply('access-rotated', 'refresh-rotated'), apiReply({}));

    await engine.transport.request({ method: HTTP_METHOD.GET, path: '/api/user/profile' });

    expect(ports.credentials.value).toContain('refresh-rotated');
    expect(ports.credentials.value).not.toContain('access-rotated');
    expect(ports.credentials.value).not.toContain('access-secret-0');
  });
});
