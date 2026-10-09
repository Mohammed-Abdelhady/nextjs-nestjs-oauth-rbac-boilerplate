/** What the native module hands back for a key. Bytes cross the bridge as base64 text. */
export interface NativeKeyRecord {
  /** iOS: the X9.63 point. Android: the DER SubjectPublicKeyInfo of the certificate key. */
  publicKey: string;
  /** One of `PROTECTION_LEVEL`. Anything else is treated as a broken answer. */
  protection: string;
}

/**
 * The part of the `AppDeviceKey` native module this package calls. Tests fake
 * this, never the port. A rejection carries one of `NATIVE_ERROR_CODE` as `code`.
 */
export interface DeviceKeyNativeApi {
  /** Resolves `null` when no key has this alias. Never creates one. */
  getKeyAsync(alias: string): Promise<NativeKeyRecord | null>;
  /** Replaces any key with this alias. */
  generateKeyAsync(alias: string, allowSoftware: boolean): Promise<NativeKeyRecord>;
  /** Signs the SHA-256 of the data. Resolves the DER signature the system returned. */
  signAsync(alias: string, data: string): Promise<string>;
  /** Resolves when no key has this alias, whether or not one existed. */
  deleteKeyAsync(alias: string): Promise<void>;
  getMarkerAsync(alias: string): Promise<boolean>;
  setMarkerAsync(alias: string, present: boolean): Promise<void>;
}
