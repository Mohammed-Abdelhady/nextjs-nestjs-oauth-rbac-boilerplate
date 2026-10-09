import { BASE64_ALPHABET, BASE64_PADDING, BASE64URL_ALPHABET } from '../constants';

function encode(bytes: Uint8Array, alphabet: string, padded: boolean): string {
  let text = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    text += alphabet.charAt(first >> 2);
    text += alphabet.charAt(((first & 0x03) << 4) | ((second ?? 0) >> 4));
    if (second === undefined) {
      text += padded ? BASE64_PADDING + BASE64_PADDING : '';
    } else {
      text += alphabet.charAt(((second & 0x0f) << 2) | ((third ?? 0) >> 6));
      text += third === undefined ? (padded ? BASE64_PADDING : '') : alphabet.charAt(third & 0x3f);
    }
  }
  return text;
}

/** Padded, the form both native sides read and write. */
export function base64Encode(bytes: Uint8Array): string {
  return encode(bytes, BASE64_ALPHABET, true);
}

/** Unpadded, the form a JWK coordinate takes. */
export function base64UrlEncode(bytes: Uint8Array): string {
  return encode(bytes, BASE64URL_ALPHABET, false);
}

/** Padded standard base64 only. Anything else is `undefined`, never a partial result. */
export function base64Decode(text: string): Uint8Array | undefined {
  if (text.length % 4 !== 0) return undefined;
  const padding = text.endsWith(BASE64_PADDING + BASE64_PADDING)
    ? 2
    : text.endsWith(BASE64_PADDING)
      ? 1
      : 0;
  const body = text.length - padding;
  const bytes = new Uint8Array((text.length / 4) * 3 - padding);
  let buffer = 0;
  let bits = 0;
  let written = 0;
  for (let index = 0; index < body; index += 1) {
    const value = BASE64_ALPHABET.indexOf(text.charAt(index));
    if (value < 0) return undefined;
    buffer = ((buffer << 6) | value) & 0xffff;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[written] = (buffer >> bits) & 0xff;
      written += 1;
    }
  }
  return bytes;
}
