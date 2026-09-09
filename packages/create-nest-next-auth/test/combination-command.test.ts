import { describe, expect, it } from 'vitest';
import { runTool } from './combination-helpers.js';

describe('asynchronous combination tools', () => {
  it('keeps worker timers responsive while a child runs', async () => {
    let ticks = 0;
    const timer = setInterval(() => ticks++, 5);
    try {
      const result = await runTool(process.execPath, [
        '-e',
        "setTimeout(() => console.log('finished'), 100)",
      ]);
      expect(result).toEqual({ ok: true, output: 'finished\n' });
      expect(ticks).toBeGreaterThan(0);
    } finally {
      clearInterval(timer);
    }
  });
  it('reports nonzero exits with diagnostic output', async () => {
    const result = await runTool(process.execPath, [
      '-e',
      "console.error('fixture failure'); process.exitCode = 7",
    ]);
    expect(result.ok).toBe(false);
    expect(result.output.split('\n').filter((line) => line === 'fixture failure')).toHaveLength(1);
  });
  it('retains stdout-only compiler diagnostics on a nonzero exit', async () => {
    const diagnostic = 'src/example.ts(1,1): error TS2322: Type mismatch';
    const encoded = Buffer.from(diagnostic).toString('hex');
    const result = await runTool(process.execPath, [
      '-e',
      `console.log(Buffer.from('${encoded}', 'hex').toString()); process.exitCode = 2`,
    ]);
    expect(result.ok).toBe(false);
    expect(result.output).toContain('Command failed:');
    expect(result.output.split('\n').filter((line) => line === diagnostic)).toHaveLength(1);
  });
  it('terminates a timed out child', async () => {
    const result = await runTool(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
      timeout: 50,
    });
    expect(result.ok).toBe(false);
  });
  it('terminates a cancelled child', async () => {
    const result = await runTool(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
      signal: AbortSignal.timeout(50),
    });
    expect(result.ok).toBe(false);
    expect(result.output).toMatch(/abort/i);
  });
});
