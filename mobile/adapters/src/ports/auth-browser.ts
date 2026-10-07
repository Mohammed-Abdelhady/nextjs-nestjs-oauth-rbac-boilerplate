import type { AuthBrowserPort, AuthBrowserResult } from '@app/native-auth';
import { browserErrorToOutcome, browserResultToOutcome } from '../logic/browser-outcome';
import type { WebBrowserApi } from '../types/modules';

export interface AuthBrowserSettings {
  /** The port hands over the authorize address only, the module needs both. */
  redirectUri: string;
  ephemeralSession: boolean;
}

export function createAuthBrowserPort(
  browser: WebBrowserApi,
  settings: AuthBrowserSettings,
): AuthBrowserPort {
  return {
    open(address, signal) {
      if (signal.aborted) return Promise.resolve({ kind: 'dismissed' });
      return new Promise<AuthBrowserResult>((resolve) => {
        let settled = false;
        const finish = (result: AuthBrowserResult): void => {
          if (settled) return;
          settled = true;
          signal.removeEventListener('abort', onAbort);
          resolve(result);
        };
        const onAbort = (): void => {
          try {
            browser.dismissAuthSession();
          } catch {
            // Android cannot close the tab. The session still ends for the engine.
          }
          finish({ kind: 'dismissed' });
        };
        signal.addEventListener('abort', onAbort);
        try {
          browser
            .openAuthSessionAsync(address, settings.redirectUri, {
              preferEphemeralSession: settings.ephemeralSession,
            })
            .then(
              (result) => finish(browserResultToOutcome(result)),
              (error: unknown) => finish(browserErrorToOutcome(error)),
            );
        } catch (error) {
          finish(browserErrorToOutcome(error));
        }
      });
    },
  };
}
