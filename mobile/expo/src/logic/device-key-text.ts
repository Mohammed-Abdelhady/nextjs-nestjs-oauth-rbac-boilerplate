import type { DeviceKeyReadiness } from '@app/device-key';
import { translate, type Locale, type MessageKey } from '../i18n/messages';

const DEVICE_KEY_MESSAGE = {
  secureEnclave: 'deviceKeySecureEnclave',
  strongBox: 'deviceKeyStrongBox',
  trustedEnvironment: 'deviceKeyTrustedEnvironment',
  software: 'deviceKeySoftware',
  noSecureHardware: 'deviceKeyNoSecureHardware',
  unavailable: 'deviceKeyUnavailable',
  keyInvalidated: 'deviceKeyInvalidated',
} as const satisfies Record<string, MessageKey>;

export function describeDeviceKey(locale: Locale, readiness: DeviceKeyReadiness): string {
  const state = readiness.kind === 'ready' ? readiness.protection : readiness.kind;
  return translate(locale, DEVICE_KEY_MESSAGE[state]);
}
