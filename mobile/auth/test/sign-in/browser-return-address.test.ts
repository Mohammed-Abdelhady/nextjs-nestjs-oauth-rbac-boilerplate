import { describe, expect, it } from 'vitest';
import * as entry from '../../src';
import { createAuthEngine } from '../support/engine';
import { CONFIG, ScriptedTransport, testPorts } from '../support/support';

describe('the return address handed to the browser port', () => {
  it('is the configured redirect address, beside the authorize address', async () => {
    const ports = testPorts(new ScriptedTransport());
    const engine = createAuthEngine(CONFIG, ports);
    await engine.restore();

    await engine.signIn();

    expect(ports.authBrowser.opened).toHaveLength(1);
    expect(ports.authBrowser.opened[0]?.redirectUri).toBe('sampleapp://auth/callback');
    expect(ports.authBrowser.opened[0]?.address).toContain(
      'https://api.example.test/api/oauth/authorize?',
    );
  });
});

describe('the engine entry', () => {
  it('exports the abort controller a shell needs to build a port signal', () => {
    const controller = new entry.PortAbortController();
    let aborts = 0;
    controller.signal.addEventListener('abort', () => {
      aborts += 1;
    });

    controller.abort();
    controller.abort();

    expect(controller.signal.aborted).toBe(true);
    expect(aborts).toBe(1);
  });
});
