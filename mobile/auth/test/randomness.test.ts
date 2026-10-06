import { describe, expect, it } from 'vitest';
import { createAuthEngine } from './engine';
import { CONFIG, ScriptedTransport, testPorts } from './support';

describe('authorization randomness', () => {
  it.each([
    ['verifier', 1],
    ['state', 2],
    ['operation id', 3],
  ])('rejects a short %s from the crypto port', async (_name, failingCall) => {
    const ports = testPorts(new ScriptedTransport());
    let call = 0;
    ports.crypto.randomBytes = async (length) => {
      call += 1;
      return new Uint8Array(call === failingCall ? length - 1 : length);
    };
    const engine = createAuthEngine(CONFIG, ports);
    await engine.restore();

    const result = await engine.signIn();

    expect(result.kind).toBe('cryptoFailure');
    expect(ports.authBrowser.opened).toHaveLength(0);
    expect(ports.credentials.value).toBeUndefined();
  });
});
