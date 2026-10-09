import { describe, expect, it } from 'vitest';
import { createAuthEngine } from '../support/engine';
import {
  CONFIG,
  ScriptedTransport,
  acceptCode,
  oauthTokenReply,
  readQueryValues,
  successUserReply,
  testPorts,
} from '../support/support';

describe('authorization state', () => {
  it('uses a fresh state for each authorization attempt', async () => {
    const transport = new ScriptedTransport();
    const ports = testPorts(transport);
    const engine = createAuthEngine(CONFIG, ports);
    await engine.restore();
    acceptCode(ports.authBrowser, 'first-code');
    transport.enqueue(oauthTokenReply('first-access', 'first-refresh'), successUserReply());
    await engine.signIn();
    const firstState = readQueryValues(ports.authBrowser.opened[0]?.address ?? '').get('state');
    transport.enqueue({ status: 200, body: {} });
    await engine.signOut();
    acceptCode(ports.authBrowser, 'second-code');
    transport.enqueue(oauthTokenReply('second-access', 'second-refresh'), successUserReply());
    await engine.signIn();
    const secondState = readQueryValues(ports.authBrowser.opened[1]?.address ?? '').get('state');

    expect(firstState).toBe('AgICAgICAgICAgICAgICAg');
    expect(secondState).toBe('BgYGBgYGBgYGBgYGBgYGBg');
    expect(secondState).not.toBe(firstState);
  });
});
