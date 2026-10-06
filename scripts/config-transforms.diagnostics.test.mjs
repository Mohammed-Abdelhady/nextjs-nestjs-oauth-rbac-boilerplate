import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import test from 'node:test';
import { command } from './verify-docker.mjs';
import { runFailureDiagnostics } from './lib/failure-diagnostics.mjs';

const diagnosticOptions = {
  budgetMs: 150,
  captureLimitMs: 20,
  reserveMs: 50,
  minimumMs: 1,
  cleanupLimitMs: 10,
};

test('failure capture completes or skips without cancelling a healthy page', async () => {
  let captured = 0;
  let cancelled = 0;
  const callbacks = {
    capture: async () => {
      captured++;
    },
    cancel: async () => {
      cancelled++;
    },
  };
  assert.equal(await runFailureDiagnostics({ ...diagnosticOptions, ...callbacks }), 'completed');
  assert.equal(
    await runFailureDiagnostics({ ...diagnosticOptions, ...callbacks, budgetMs: 50 }),
    'skipped',
  );
  assert.equal(captured, 1);
  assert.equal(cancelled, 0);
});

for (const cleanup of ['completed', 'rejected', 'never-settles']) {
  test(`stalled capture is aborted with ${cleanup} cleanup and no later stage`, async () => {
    let continueCapture;
    let laterStage = false;
    let signal;
    let cancelled = false;
    const result = await runFailureDiagnostics({
      ...diagnosticOptions,
      capture: async (abortSignal) => {
        signal = abortSignal;
        await new Promise((resolve) => {
          continueCapture = resolve;
        });
        abortSignal.throwIfAborted();
        laterStage = true;
      },
      cancel: async () => {
        cancelled = true;
        if (cleanup === 'rejected') throw new Error('cleanup failed');
        if (cleanup === 'never-settles') await new Promise(() => {});
      },
    });
    assert.equal(result, 'timed-out');
    assert.equal(cancelled, true);
    assert.equal(signal.aborted, true);
    continueCapture();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(laterStage, false);
  });
}

test('rejected capture remains secondary to the identical original error', async () => {
  const original = new Error('original overflow assertion');
  const errors = [];
  try {
    throw original;
  } catch (error) {
    errors.push(error);
  }
  let cancelled = false;
  assert.equal(
    await runFailureDiagnostics({
      ...diagnosticOptions,
      capture: async () => {
        throw new Error('diagnostic failure');
      },
      cancel: async () => {
        cancelled = true;
        throw new Error('cleanup failure');
      },
    }),
    'failed',
  );
  assert.equal(cancelled, true);
  assert.equal(errors.length, 1);
  assert.equal(errors[0], original);
});

test('real Playwright afterEach preserves original failures when capture rejects or stalls', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'failure-capture-test-'));
  try {
    const require = createRequire(new URL('../frontend/package.json', import.meta.url));
    const playwright = require.resolve('@playwright/test');
    const helper = new URL('./lib/failure-diagnostics.mjs', import.meta.url).href;
    const config = join(directory, 'playwright.config.cjs');
    const report = join(directory, 'results.json');
    await writeFile(
      config,
      `module.exports = ${JSON.stringify({
        testDir: directory,
        testMatch: 'capture.spec.cjs',
        timeout: 1000,
        workers: 1,
        retries: 0,
        reporter: [['json', { outputFile: report }]],
      })};`,
    );
    await writeFile(
      join(directory, 'capture.spec.cjs'),
      `
      const { test, expect } = require(${JSON.stringify(playwright)});
      test.afterEach(async ({}, info) => {
        expect(info.error.message).toBe('Error: original overflow assertion');
        const { runFailureDiagnostics } = await import(${JSON.stringify(helper)});
        await runFailureDiagnostics({
          budgetMs: info.timeout, captureLimitMs: 20, reserveMs: 50, minimumMs: 1, cleanupLimitMs: 10,
          capture: async () => {
            if (info.title === 'rejected') throw new Error('capture rejected');
            if (info.title === 'stalled') await new Promise(() => {});
          },
          cancel: async () => { await new Promise(() => {}); },
        });
      });
      for (const name of ['completed', 'rejected', 'stalled']) {
        test(name, async () => { throw new Error('original overflow assertion'); });
      }
    `,
    );
    await assert.rejects(
      command(
        process.execPath,
        [
          join(dirname(require.resolve('playwright/package.json')), 'cli.js'),
          'test',
          '--config',
          config,
        ],
        {
          cwd: directory,
          env: { PATH: process.env.PATH },
          timeout: 15000,
        },
      ),
      /exited 1/,
    );
    const result = JSON.parse(await readFile(report, 'utf8'));
    const results = result.suites.flatMap((suite) =>
      suite.specs.flatMap((spec) => spec.tests.flatMap((item) => item.results)),
    );
    assert.equal(results.length, 3);
    for (const item of results) {
      assert.equal(item.status, 'failed');
      assert.equal(
        item.errors.length,
        1,
        JSON.stringify(item.errors.map((error) => error.message)),
      );
      assert.equal(item.errors[0].message.split('\n')[0], 'Error: original overflow assertion');
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
