import { BASE64URL_ALPHABET } from './encoding-constants';
import { UTF8_REPLACEMENT_CODE_POINT } from '../constants';
import type { CryptoPort } from '../types/auth';

export function base64UrlEncode(bytes: ArrayLike<number>): string {
  let result = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const first = (bytes[index] ?? 0) & 255;
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    result += BASE64URL_ALPHABET[first >> 2];
    result += BASE64URL_ALPHABET[((first & 3) << 4) | (((second ?? 0) & 255) >> 4)];
    if (second !== undefined) {
      const secondByte = second & 255;
      result += BASE64URL_ALPHABET[((secondByte & 15) << 2) | (((third ?? 0) & 255) >> 6)];
    }
    if (third !== undefined) result += BASE64URL_ALPHABET[third & 255 & 63];
  }
  return result;
}

export async function pkceChallenge(
  verifier: string,
  crypto: Pick<CryptoPort, 'sha256'>,
): Promise<string> {
  const digest = await crypto.sha256(asciiBytes(verifier));
  if (digest.length !== 32) throw new TypeError('SHA-256 must return 32 bytes');
  return base64UrlEncode(digest);
}

export function utf8Bytes(value: string): Uint8Array {
  const bytes: number[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const current = value.charCodeAt(index);
    let point = current;
    if (current >= 0xd800 && current <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        point = 0x10000 + ((current - 0xd800) << 10) + (next - 0xdc00);
        index += 1;
      } else {
        point = UTF8_REPLACEMENT_CODE_POINT;
      }
    } else if (current >= 0xdc00 && current <= 0xdfff) {
      point = UTF8_REPLACEMENT_CODE_POINT;
    }
    appendUtf8(bytes, point);
  }
  return Uint8Array.from(bytes);
}

function asciiBytes(value: string): Uint8Array {
  return Uint8Array.from(value, (character) => character.charCodeAt(0));
}

function appendUtf8(bytes: number[], point: number): void {
  if (point <= 0x7f) {
    bytes.push(point);
  } else if (point <= 0x7ff) {
    bytes.push(0xc0 | (point >> 6), 0x80 | (point & 0x3f));
  } else if (point <= 0xffff) {
    bytes.push(0xe0 | (point >> 12), 0x80 | ((point >> 6) & 0x3f), 0x80 | (point & 0x3f));
  } else {
    bytes.push(
      0xf0 | (point >> 18),
      0x80 | ((point >> 12) & 0x3f),
      0x80 | ((point >> 6) & 0x3f),
      0x80 | (point & 0x3f),
    );
  }
}
