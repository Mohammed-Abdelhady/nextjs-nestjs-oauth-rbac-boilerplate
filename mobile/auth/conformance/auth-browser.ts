import { PortAbortController } from '../src/abort-controller';
import type { AuthBrowserResult } from '../src';
import { CHECK_ID, SAMPLE } from './constants';
import { attempt, describeValue, expectEqual, expectTrue, settlement } from './expect';
import type { BrowserScript, ConformanceCheck, ConformanceSubject } from './types';

const ABORT_OUTCOMES: readonly AuthBrowserResult['kind'][] = ['cancelled', 'dismissed', 'failed'];

async function openWith(
  subject: ConformanceSubject,
  script: BrowserScript,
): Promise<AuthBrowserResult> {
  await subject.driver.authBrowser.script(script);
  const result = await attempt('authBrowser.open()', () =>
    subject.adapters.authBrowser.open(
      SAMPLE.AUTHORIZE_ADDRESS,
      SAMPLE.REDIRECT_URI,
      new PortAbortController().signal,
    ),
  );
  return result;
}

function outcomeCheck(
  id: ConformanceCheck['id'],
  script: { kind: 'cancelled' } | { kind: 'dismissed' },
): ConformanceCheck {
  return {
    id,
    port: 'authBrowser',
    async run(subject) {
      expectEqual(await openWith(subject, script), script, `a ${script.kind} session`);
    },
  };
}

export const AUTH_BROWSER_CHECKS: readonly ConformanceCheck[] = [
  {
    id: CHECK_ID.BROWSER_REDIRECT,
    port: 'authBrowser',
    async run(subject) {
      const script = { kind: 'redirect', url: SAMPLE.RETURN_ADDRESS } as const;
      expectEqual(await openWith(subject, script), script, 'a redirect session');
      expectEqual(
        await subject.driver.authBrowser.lastAddress(),
        SAMPLE.AUTHORIZE_ADDRESS,
        'address handed to the browser',
      );
    },
  },
  {
    // The engine validated this address. A copy kept by the adapter can drift from it.
    id: CHECK_ID.BROWSER_RETURN_ADDRESS,
    port: 'authBrowser',
    async run(subject) {
      await openWith(subject, { kind: 'cancelled' });
      expectEqual(
        await subject.driver.authBrowser.lastRedirectUri(),
        SAMPLE.REDIRECT_URI,
        'return address handed to the browser',
      );
    },
  },
  outcomeCheck(CHECK_ID.BROWSER_CANCELLED, { kind: 'cancelled' }),
  outcomeCheck(CHECK_ID.BROWSER_DISMISSED, { kind: 'dismissed' }),
  {
    id: CHECK_ID.BROWSER_FAILED,
    port: 'authBrowser',
    async run(subject) {
      const result = await openWith(subject, { kind: 'failed', reason: 'session failed' });
      expectTrue(
        result.kind === 'failed' && typeof result.reason === 'string' && result.reason.length > 0,
        `a failed session must report failed with a reason, got ${describeValue(result)}`,
      );
    },
  },
  {
    id: CHECK_ID.BROWSER_ABORT,
    port: 'authBrowser',
    async run(subject) {
      const { adapters, driver } = subject;
      const controller = new PortAbortController();
      await driver.authBrowser.script({ kind: 'pending' });
      const opened = Promise.resolve().then(() =>
        adapters.authBrowser.open(SAMPLE.AUTHORIZE_ADDRESS, SAMPLE.REDIRECT_URI, controller.signal),
      );
      expectEqual((await settlement(opened, driver)).state, 'pending', 'session before abort');

      controller.abort();
      const after = await settlement(opened, driver);

      expectTrue(
        after.state === 'resolved' && ABORT_OUTCOMES.includes(after.value.kind),
        `an aborted session must resolve as cancelled, dismissed or failed, it is ${describeValue(after)}`,
      );
      expectEqual(await driver.authBrowser.isOpen(), false, 'session held after abort');
    },
  },
];
