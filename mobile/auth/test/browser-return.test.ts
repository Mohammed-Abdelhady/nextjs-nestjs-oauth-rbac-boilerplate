import { describe, expect, it } from 'vitest';
import { createAuthEngine } from './engine';
import { CONFIG, ScriptedTransport, readQueryValues, testPorts } from './support';

describe('browser return addresses', () => {
  it('ends with invalidCallback when the browser returns an unowned address', async () => {
    const ports = testPorts(new ScriptedTransport());
    ports.authBrowser.results.push(() => ({ kind: 'redirect', url: 'sampleapp://products/42' }));
    const engine = createAuthEngine(CONFIG, ports);
    await engine.restore();

    const outcome = await engine.signIn();

    expect(outcome).toEqual({ kind: 'invalidCallback', reason: 'destinationMismatch' });
    expect(ports.credentials.value).toBeUndefined();
    expect(engine.snapshot).toMatchObject({ status: 'signedOut', operation: 'none' });
  });

  it('rejects a callback that exceeds the parser size limit', async () => {
    const ports = testPorts(new ScriptedTransport());
    ports.authBrowser.results.push((address) => {
      const state = readQueryValues(address).get('state');
      return {
        kind: 'redirect',
        url: `${CONFIG.redirectUri}?code=${'x'.repeat(5000)}&state=${state}`,
      };
    });
    const engine = createAuthEngine(CONFIG, ports);
    await engine.restore();

    const outcome = await engine.signIn();

    expect(outcome).toEqual({ kind: 'invalidCallback', reason: 'tooLong' });
    expect(ports.credentials.value).toBeUndefined();
    expect(engine.snapshot).toMatchObject({ status: 'signedOut', operation: 'none' });
  });
});
