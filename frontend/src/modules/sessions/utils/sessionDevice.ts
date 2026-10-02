import { parseUserAgent } from '@/lib/parseUserAgent';
import type { DeviceType } from '../components/DeviceIcon';
import { SESSION_KIND_BY_PURPOSE, UNKNOWN_OS_LABELS, type SessionKind } from '../constants';

const KIND_BY_PURPOSE = new Map<string, SessionKind>(Object.entries(SESSION_KIND_BY_PURPOSE));

/** The kind a row shows, or nothing for a purpose this build does not know. */
export function sessionKindOf(credentialPurpose: string): SessionKind | undefined {
  return KIND_BY_PURPOSE.get(credentialPurpose);
}

export interface NativeDevice {
  readonly deviceType: DeviceType;
  /** Null when the app's user agent names no system. */
  readonly os: string | null;
}

/**
 * A native session's user agent comes from the app's HTTP client, so the
 * browser half of the parse is noise and an unrecognised agent is not a desktop.
 */
export function describeNativeDevice(userAgent: string): NativeDevice {
  const { device, os } = parseUserAgent(userAgent);
  return {
    deviceType: device === 'Tablet' ? 'Tablet' : 'Mobile',
    os: UNKNOWN_OS_LABELS.includes(os) ? null : os,
  };
}
