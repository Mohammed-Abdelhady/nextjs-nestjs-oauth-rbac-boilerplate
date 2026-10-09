import { createPublicKey, verify } from 'node:crypto';
import type { DeviceKeyResult, Es256PublicJwk } from '@app/native-auth';
import { createDeviceKey } from '../src';
import type { DeviceKey, DeviceKeySettings } from '../src';
import { type NodeKey, nodeKeySource, type Platform } from './node-keys';
import { FakeDeviceKeyNative, type FakeHardware } from './support';

export const SETTINGS: DeviceKeySettings = {
  clientId: 'native-client',
  environment: 'development',
  protection: 'hardwareOnly',
};
/** Written out, so a change to how the alias is built shows up here. */
export const ALIAS = 'devicekey.hw.native-client.development';
export const SOFTWARE_ALIAS = 'devicekey.sw.native-client.development';

export interface Device {
  platform: Platform;
  hardware: FakeHardware;
}

export interface HardwareDevice extends Device {
  hardware: Exclude<FakeHardware, 'none'>;
}

export const IPHONE: HardwareDevice = { platform: 'ios', hardware: 'secureEnclave' };
export const DEVICES: readonly HardwareDevice[] = [
  IPHONE,
  { platform: 'android', hardware: 'strongBox' },
  { platform: 'android', hardware: 'trustedEnvironment' },
];

export interface Subject {
  native: FakeDeviceKeyNative<NodeKey>;
  key: DeviceKey;
}

export function subject(
  device: Device = IPHONE,
  settings: Partial<DeviceKeySettings> = {},
): Subject {
  const native = new FakeDeviceKeyNative({
    hardware: device.hardware,
    keys: nodeKeySource(device.platform),
  });
  return { native, key: createDeviceKey(native, { ...SETTINGS, ...settings }) };
}

/** The public key Node derives from the private key the fake holds. */
export function storedPublicJwk(
  native: FakeDeviceKeyNative<NodeKey>,
  alias: string,
): Es256PublicJwk {
  const stored = native.keys.get(alias);
  if (!stored) throw new Error(`The fake holds no key named ${alias}`);
  return stored.key.jwk;
}

export function valueOf<T>(result: DeviceKeyResult<T>): T {
  if (result.kind !== 'success') throw new Error(`Expected success, got ${result.kind}`);
  return result.value;
}

/** Node checks the raw signature against the JWK. None of this package's code runs here. */
export function nodeVerifies(
  jwk: Es256PublicJwk,
  data: Uint8Array,
  signature: Uint8Array,
): boolean {
  return verify(
    'sha256',
    data,
    { key: createPublicKey({ key: jwk, format: 'jwk' }), dsaEncoding: 'ieee-p1363' },
    signature,
  );
}
