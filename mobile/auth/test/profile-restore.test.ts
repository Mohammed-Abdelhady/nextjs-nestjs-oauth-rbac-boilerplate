import { describe, expect, it } from 'vitest';
import { createAuthEngine } from './engine';
import { CONFIG, ScriptedTransport, establishSession, testPorts } from './support';

describe('profile across restore', () => {
  it('keeps the sign-in profile when restore is called in the same run', async () => {
    const transport = new ScriptedTransport();
    const ports = testPorts(transport);
    const engine = createAuthEngine(CONFIG, ports);
    await establishSession(engine, ports, transport);
    const profile = engine.snapshot.profile;

    const result = await engine.restore();

    expect(result).toEqual({ kind: 'restored', status: 'signedIn' });
    expect(engine.snapshot.profile).toEqual(profile);
  });
});
