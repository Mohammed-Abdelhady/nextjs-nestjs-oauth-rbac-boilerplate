import type { DeviceKeyPort } from '@app/native-auth';
import type { KEY_PROTECTION, NATIVE_CONDITION, PROTECTION_LEVEL } from '../constants';

export type KeyProtection = (typeof KEY_PROTECTION)[keyof typeof KEY_PROTECTION];
export type ProtectionLevel = (typeof PROTECTION_LEVEL)[keyof typeof PROTECTION_LEVEL];
export type NativeCondition = (typeof NATIVE_CONDITION)[keyof typeof NATIVE_CONDITION];

export interface DeviceKeySettings {
  clientId: string;
  environment: string;
  /** Required. `softwareAllowed` is for simulators and emulators. */
  protection: KeyProtection;
}

export type DeviceKeyReadiness =
  | { kind: 'ready'; protection: ProtectionLevel }
  /** Permanent on this device. The port reports it as `unavailable`. */
  | { kind: 'noSecureHardware' }
  | { kind: 'unavailable' }
  | { kind: 'keyInvalidated' };

export type DeviceKeyDeletion = { kind: 'deleted' } | { kind: 'unavailable' };

export interface DeviceKey extends DeviceKeyPort {
  /** Creates or reads the key and says how it is protected. */
  prepare(): Promise<DeviceKeyReadiness>;
  /** Removes the key. The next use creates a new one, and bound sessions need sign-in. */
  delete(): Promise<DeviceKeyDeletion>;
}
