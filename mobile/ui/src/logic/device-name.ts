import type { DeviceName } from '../types';

type Family = readonly [pattern: RegExp, name: string];

/** Ordered: an iPhone agent also says "Mac OS X", and Edge and Opera also say "Chrome". */
const SYSTEMS: readonly Family[] = [
  [/windows/i, 'Windows'],
  [/ipad/i, 'iPadOS'],
  [/iphone|ipod/i, 'iOS'],
  [/mac os x|macintosh/i, 'macOS'],
  [/android/i, 'Android'],
  [/cros/i, 'ChromeOS'],
  [/linux/i, 'Linux'],
];

/** The app's HTTP client names its library, not the phone, so the library stands for the system. */
const APP_SYSTEMS: readonly Family[] = [
  ...SYSTEMS,
  [/cfnetwork|darwin/i, 'iOS'],
  [/okhttp|dalvik/i, 'Android'],
];

const BROWSERS: readonly Family[] = [
  [/edg/i, 'Edge'],
  [/opera|opr\//i, 'Opera'],
  [/samsungbrowser/i, 'Samsung Internet'],
  [/firefox|fxios/i, 'Firefox'],
  [/chrome|crios/i, 'Chrome'],
  [/safari/i, 'Safari'],
];

function familyOf(userAgent: string, families: readonly Family[]): string | undefined {
  return families.find(([pattern]) => pattern.test(userAgent))?.[1];
}

/**
 * What a row calls its device. A name the server stored wins. The app's own
 * user agent is not a browser, so a native session is named by its system alone.
 */
export function deviceNameOf(
  session: { deviceName?: string; userAgent: string },
  isNativeApp: boolean,
): DeviceName {
  const stored = session.deviceName?.trim();
  if (stored) return { kind: 'named', name: stored };
  const system = familyOf(session.userAgent, isNativeApp ? APP_SYSTEMS : SYSTEMS);
  if (system === undefined) return { kind: 'unknown' };
  const browser = isNativeApp ? undefined : familyOf(session.userAgent, BROWSERS);
  return browser === undefined
    ? { kind: 'named', name: system }
    : { kind: 'browser', browser, system };
}
