import { describe, expect, it } from 'vitest';
import { createAuthEngine } from './engine';
import { CONFIG, ScriptedTransport, establishSession, testPorts } from './support';

describe('snapshot subscriptions', () => {
  it('removes a listener whose initial notification throws', async () => {
    const transport = new ScriptedTransport();
    const ports = testPorts(transport);
    const engine = createAuthEngine(CONFIG, ports);
    await establishSession(engine, ports, transport);
    let notifications = 0;

    expect(() =>
      engine.subscribe(() => {
        notifications += 1;
        throw new Error('listener failed');
      }),
    ).toThrow('listener failed');
    await engine.signOut();

    expect(notifications).toBe(1);
    expect(engine.snapshot).toMatchObject({ status: 'signedOut', operation: 'none' });
  });
});
