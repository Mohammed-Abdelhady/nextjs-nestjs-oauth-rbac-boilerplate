import type { Es256PublicJwk } from '@app/native-auth';
import { PROTECTION_LEVEL } from '../constants';
import type { ProtectionLevel } from '../types/device-key';
import type { NativeKeyRecord } from '../types/native';
import { base64Decode } from './base64';
import { publicJwk } from './public-jwk';

export interface ReadKey {
  jwk: Es256PublicJwk;
  protection: ProtectionLevel;
}

const LEVELS: readonly string[] = Object.values(PROTECTION_LEVEL);

function isProtectionLevel(value: string): value is ProtectionLevel {
  return LEVELS.includes(value);
}

/** A record the native side could not have meant is `undefined`, never a guess. */
export function readKeyRecord(record: NativeKeyRecord): ReadKey | undefined {
  if (typeof record.publicKey !== 'string' || typeof record.protection !== 'string') {
    return undefined;
  }
  if (!isProtectionLevel(record.protection)) return undefined;
  const encoded = base64Decode(record.publicKey);
  const jwk = encoded === undefined ? undefined : publicJwk(encoded);
  return jwk === undefined ? undefined : { jwk, protection: record.protection };
}
