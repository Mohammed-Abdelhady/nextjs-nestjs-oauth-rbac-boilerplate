import { NATIVE_ERROR_CODE, PROTECTION_LEVEL } from '../../src/constants';
import { base64Decode, base64Encode } from '../../src/logic/base64';
import type { ProtectionLevel } from '../../src/types/device-key';
import type { DeviceKeyNativeApi, NativeKeyRecord } from '../../src/types/native';

/** One key as a platform holds it: the private half never leaves `sign`. */
export interface FakeKey {
  /** In the platform's own encoding: an X9.63 point on iOS, a DER certificate key on Android. */
  publicKey: Uint8Array;
  /** The DER signature both platforms return. */
  sign(data: Uint8Array): Uint8Array;
}

/** Where the fake gets a new key. A Node test passes one backed by a real P-256 key. */
export interface FakeKeySource<TKey extends FakeKey = FakeKey> {
  create(): TKey;
}

export type FakeHardware = Exclude<ProtectionLevel, 'software'> | 'none';
export type FakeNativeMethod = keyof DeviceKeyNativeApi;

export interface FakeNativeOptions<TKey extends FakeKey = FakeKey> {
  hardware: FakeHardware;
  keys: FakeKeySource<TKey>;
}

export interface FakeStoredKey<TKey extends FakeKey = FakeKey> {
  key: TKey;
  protection: ProtectionLevel;
  invalidated: boolean;
}

/** A rejection shaped like the one an Expo module produces. */
export function nativeError(code: string): Error {
  return Object.assign(new Error(code), { code });
}

/**
 * Stands in for the Swift and Kotlin modules. It imports nothing from Node or
 * from a platform, so it runs in a unit test and on a device alike.
 */
export class FakeDeviceKeyNative<TKey extends FakeKey = FakeKey> implements DeviceKeyNativeApi {
  readonly calls: FakeNativeMethod[] = [];
  readonly keys = new Map<string, FakeStoredKey<TKey>>();
  readonly markers = new Set<string>();
  /** Replaces the next signature answer, to stand in for a broken platform. */
  signatureOverride: string | undefined;
  /** Replaces the next key answer. */
  recordOverride: NativeKeyRecord | undefined;
  private readonly failures = new Map<FakeNativeMethod, string[]>();
  private readonly gates = new Map<FakeNativeMethod, Promise<void>>();

  constructor(private readonly options: FakeNativeOptions<TKey>) {}

  /** The next call of this method rejects with the code. */
  failNext(method: FakeNativeMethod, code: string = NATIVE_ERROR_CODE.UNAVAILABLE): void {
    this.failures.set(method, [...(this.failures.get(method) ?? []), code]);
  }

  /** Calls of this method wait until the returned function runs. */
  hold(method: FakeNativeMethod): () => void {
    let release: () => void = () => undefined;
    this.gates.set(
      method,
      new Promise<void>((resolve) => {
        release = resolve;
      }),
    );
    return () => {
      this.gates.delete(method);
      release();
    };
  }

  /** Puts a known key in place, as if an earlier app start had created it. */
  install(alias: string, key: TKey, protection: ProtectionLevel): void {
    this.keys.set(alias, { key, protection, invalidated: false });
  }

  /** The system removed the key and left the app's files, as a device restore does. */
  loseKey(alias: string): void {
    this.keys.delete(alias);
  }

  /** The system refuses to use the key again. */
  invalidate(alias: string): void {
    const stored = this.keys.get(alias);
    if (stored) stored.invalidated = true;
  }

  count(method: FakeNativeMethod): number {
    return this.calls.filter((call) => call === method).length;
  }

  async getKeyAsync(alias: string): Promise<NativeKeyRecord | null> {
    await this.enter('getKeyAsync');
    const stored = this.keys.get(alias);
    return stored ? this.record(stored) : null;
  }

  async generateKeyAsync(alias: string, allowSoftware: boolean): Promise<NativeKeyRecord> {
    await this.enter('generateKeyAsync');
    const { hardware, keys } = this.options;
    if (hardware === 'none' && !allowSoftware) throw nativeError(NATIVE_ERROR_CODE.NO_HARDWARE);
    const stored: FakeStoredKey<TKey> = {
      key: keys.create(),
      protection: hardware === 'none' ? PROTECTION_LEVEL.SOFTWARE : hardware,
      invalidated: false,
    };
    this.keys.set(alias, stored);
    return this.record(stored);
  }

  async signAsync(alias: string, data: string): Promise<string> {
    await this.enter('signAsync');
    const stored = this.keys.get(alias);
    if (!stored) throw nativeError(NATIVE_ERROR_CODE.NOT_FOUND);
    if (stored.invalidated) throw nativeError(NATIVE_ERROR_CODE.INVALIDATED);
    const override = this.signatureOverride;
    if (override !== undefined) {
      this.signatureOverride = undefined;
      return override;
    }
    const bytes = base64Decode(data);
    if (bytes === undefined) throw nativeError(NATIVE_ERROR_CODE.UNAVAILABLE);
    return base64Encode(stored.key.sign(bytes));
  }

  async deleteKeyAsync(alias: string): Promise<void> {
    await this.enter('deleteKeyAsync');
    this.keys.delete(alias);
  }

  async getMarkerAsync(alias: string): Promise<boolean> {
    await this.enter('getMarkerAsync');
    return this.markers.has(alias);
  }

  async setMarkerAsync(alias: string, present: boolean): Promise<void> {
    await this.enter('setMarkerAsync');
    if (present) this.markers.add(alias);
    else this.markers.delete(alias);
  }

  private async enter(method: FakeNativeMethod): Promise<void> {
    this.calls.push(method);
    await this.gates.get(method);
    const code = this.failures.get(method)?.shift();
    if (code !== undefined) throw nativeError(code);
  }

  private record(stored: FakeStoredKey<TKey>): NativeKeyRecord {
    const override = this.recordOverride;
    if (override !== undefined) {
      this.recordOverride = undefined;
      return override;
    }
    return { publicKey: base64Encode(stored.key.publicKey), protection: stored.protection };
  }
}
