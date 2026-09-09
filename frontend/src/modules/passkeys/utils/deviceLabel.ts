import { DEVICE_LABEL_KEY, type DeviceLabelKey } from '../constants';

/** Checked in order: iPadOS calls itself a Mac, and Android calls itself Linux. */
const DEVICE_PATTERNS: ReadonlyArray<readonly [RegExp, DeviceLabelKey]> = [
  [/iPhone/i, DEVICE_LABEL_KEY.IPHONE],
  [/iPad/i, DEVICE_LABEL_KEY.IPAD],
  [/Android/i, DEVICE_LABEL_KEY.ANDROID],
  [/Windows/i, DEVICE_LABEL_KEY.WINDOWS],
  [/Mac OS X|Macintosh/i, DEVICE_LABEL_KEY.MAC],
  [/Linux|X11|CrOS/i, DEVICE_LABEL_KEY.LINUX],
];

/**
 * The device family to name a new passkey after, from the user agent.
 *
 * Only used to fill a text field the reader can overwrite, so a wrong guess
 * costs a keystroke. A touch-capable Mac user agent is an iPad, which is why
 * the tablet check comes first.
 */
export function deviceLabelKey(userAgent: string): DeviceLabelKey {
  if (/Macintosh/i.test(userAgent) && /Mobile|Touch/i.test(userAgent)) {
    return DEVICE_LABEL_KEY.IPAD;
  }

  const match = DEVICE_PATTERNS.find(([pattern]) => pattern.test(userAgent));
  return match ? match[1] : DEVICE_LABEL_KEY.OTHER;
}

/** The device family of the browser this runs in. */
export function currentDeviceLabelKey(): DeviceLabelKey {
  if (typeof navigator === 'undefined') {
    return DEVICE_LABEL_KEY.OTHER;
  }

  return deviceLabelKey(navigator.userAgent);
}
