import type { DeviceKeyResult, Es256PublicJwk } from '@app/native-auth';
import { KEY_PROTECTION, NATIVE_CONDITION, PROTECTION_LEVEL } from './constants';
import { keyAlias } from './logic/alias';
import { base64Decode, base64Encode } from './logic/base64';
import { derToRawSignature } from './logic/der-signature';
import { readKeyRecord, type ReadKey } from './logic/key-record';
import { nativeCondition } from './logic/native-errors';
import { createSerial } from './logic/serial';
import type {
  DeviceKey,
  DeviceKeyDeletion,
  DeviceKeyReadiness,
  DeviceKeySettings,
} from './types/device-key';
import type { DeviceKeyNativeApi } from './types/native';

type Ensured = ({ kind: 'ready' } & ReadKey) | Exclude<DeviceKeyReadiness, { kind: 'ready' }>;

/**
 * The key for one client id and environment. Build it once per app start: calls
 * run one at a time, so two first uses create one key between them.
 */
export function createDeviceKey(
  native: DeviceKeyNativeApi,
  settings: DeviceKeySettings,
): DeviceKey {
  const alias = keyAlias(settings);
  const allowSoftware = settings.protection === KEY_PROTECTION.SOFTWARE_ALLOWED;
  const serial = createSerial();
  let markerWritten = false;

  async function writeMarker(): Promise<void> {
    if (markerWritten) return;
    try {
      await native.setMarkerAsync(alias, true);
      markerWritten = true;
    } catch {
      // The next read writes it. Until then a lost key reads as a first use.
    }
  }

  async function clearMarker(): Promise<void> {
    markerWritten = false;
    await native.setMarkerAsync(alias, false).catch(() => undefined);
  }

  /** A key the system will not use again is removed, so the next use starts clean. */
  async function discard(): Promise<{ kind: 'keyInvalidated' }> {
    await native.deleteKeyAsync(alias).catch(() => undefined);
    await clearMarker();
    return { kind: 'keyInvalidated' };
  }

  async function failure(error: unknown): Promise<Exclude<Ensured, { kind: 'ready' }>> {
    const condition = nativeCondition(error);
    if (condition === NATIVE_CONDITION.INVALIDATED || condition === NATIVE_CONDITION.NOT_FOUND) {
      return discard();
    }
    return condition === NATIVE_CONDITION.NO_SECURE_HARDWARE
      ? { kind: 'noSecureHardware' }
      : { kind: 'unavailable' };
  }

  async function ensure(): Promise<Ensured> {
    try {
      let record = await native.getKeyAsync(alias);
      if (record === null) {
        // A marker with no key means the system dropped a key this app made.
        if (await native.getMarkerAsync(alias)) {
          await clearMarker();
          return { kind: 'keyInvalidated' };
        }
        record = await native.generateKeyAsync(alias, allowSoftware);
      }
      const key = readKeyRecord(record);
      if (key === undefined) return { kind: 'unavailable' };
      if (key.protection === PROTECTION_LEVEL.SOFTWARE && !allowSoftware) {
        await native.deleteKeyAsync(alias).catch(() => undefined);
        await clearMarker();
        return { kind: 'noSecureHardware' };
      }
      await writeMarker();
      return { kind: 'ready', ...key };
    } catch (error) {
      return failure(error);
    }
  }

  async function publicKey(): Promise<DeviceKeyResult<Es256PublicJwk>> {
    const ensured = await ensure();
    if (ensured.kind === 'ready') return { kind: 'success', value: ensured.jwk };
    return ensured.kind === 'keyInvalidated' ? ensured : { kind: 'unavailable' };
  }

  async function sign(data: Uint8Array): Promise<DeviceKeyResult<Uint8Array>> {
    try {
      const der = base64Decode(await native.signAsync(alias, base64Encode(data)));
      const signature = der === undefined ? undefined : derToRawSignature(der);
      return signature === undefined
        ? { kind: 'unavailable' }
        : { kind: 'success', value: signature };
    } catch (error) {
      const failed = await failure(error);
      return failed.kind === 'keyInvalidated' ? failed : { kind: 'unavailable' };
    }
  }

  async function prepare(): Promise<DeviceKeyReadiness> {
    const ensured = await ensure();
    return ensured.kind === 'ready' ? { kind: 'ready', protection: ensured.protection } : ensured;
  }

  async function remove(): Promise<DeviceKeyDeletion> {
    try {
      // Marker first: a key left without one is picked up again, not reported lost.
      markerWritten = false;
      await native.setMarkerAsync(alias, false);
      await native.deleteKeyAsync(alias);
      return { kind: 'deleted' };
    } catch {
      return { kind: 'unavailable' };
    }
  }

  return {
    publicKey: () => serial(publicKey),
    sign: (data) => serial(() => sign(data)),
    prepare: () => serial(prepare),
    delete: () => serial(remove),
  };
}
