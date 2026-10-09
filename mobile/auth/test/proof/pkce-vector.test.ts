import { describe, expect, it } from 'vitest';
import { createAuthEngine } from '../support/engine';
import { sha256 } from '../support/sha256';
import {
  CONFIG,
  ScriptedTransport,
  acceptCode,
  oauthTokenReply,
  readQueryValues,
  successUserReply,
  testPorts,
} from '../support/support';

describe('PKCE transaction vector', () => {
  it('sends the RFC 7636 S256 challenge and verifier through the engine', async () => {
    const transport = new ScriptedTransport();
    const ports = testPorts(transport);
    const vectorBytes = Uint8Array.from([
      116, 24, 223, 180, 151, 153, 224, 37, 79, 250, 96, 125, 216, 173, 187, 186, 22, 212, 37, 77,
      105, 214, 191, 240, 91, 88, 5, 88, 83, 132, 141, 121,
    ]);
    let randomCalls = 0;
    ports.crypto.randomBytes = async (length) => {
      randomCalls += 1;
      return randomCalls === 1 ? vectorBytes : new Uint8Array(length).fill(randomCalls);
    };
    ports.crypto.sha256 = async (bytes) => sha256(bytes);
    transport.enqueue(oauthTokenReply(), successUserReply());
    acceptCode(ports.authBrowser, 'vector-code');
    const engine = createAuthEngine(CONFIG, ports);
    await engine.restore();

    const outcome = await engine.signIn();
    const authorize = readQueryValues(ports.authBrowser.opened[0]?.address ?? '');
    const exchange = transport.sent.find(({ path }) => path === '/api/oauth/token');

    expect(outcome.kind).toBe('signedIn');
    expect(authorize.get('code_challenge')).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
    expect(authorize.get('code_challenge_method')).toBe('S256');
    expect(exchange?.body).toMatchObject({
      code_verifier: 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk',
    });
  });

  it('creates a new OAuth state for each attempt', async () => {
    const ports = testPorts(new ScriptedTransport());
    ports.authBrowser.results.push(
      () => ({ kind: 'cancelled' }),
      () => ({ kind: 'cancelled' }),
    );
    const engine = createAuthEngine(CONFIG, ports);
    await engine.restore();

    await engine.signIn();
    await engine.signIn();

    const first = readQueryValues(ports.authBrowser.opened[0]?.address ?? '').get('state');
    const second = readQueryValues(ports.authBrowser.opened[1]?.address ?? '').get('state');
    expect(first).toBe('AgICAgICAgICAgICAgICAg');
    expect(second).toBe('BQUFBQUFBQUFBQUFBQUFBQ');
    expect(second).not.toBe(first);
  });
});
