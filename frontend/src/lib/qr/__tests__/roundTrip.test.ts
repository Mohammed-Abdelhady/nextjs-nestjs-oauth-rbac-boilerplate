import { describe, expect, it } from 'vitest';
import { BLOCK_COUNT, EC_CODEWORDS_PER_BLOCK, TOTAL_CODEWORDS } from '../tables';
import { byteCapacity, characterCountBits, dataCodewordCount } from '../encode';
import { formatBits } from '../format';
import { remainder } from '../galois';
import { encodeQrCode, type QrCode } from '../index';
import { MASK_FUNCTIONS } from '../mask';
import { createSymbol } from '../patterns';

/**
 * A reader written against the same specification as the encoder, used to
 * prove that what the encoder draws is what a scanner reads back.
 */

function readMask(code: QrCode): number {
  let bits = 0;
  for (let i = 0; i <= 5; i++) {
    bits |= (code.modules[i][8] ? 1 : 0) << i;
  }
  bits |= (code.modules[7][8] ? 1 : 0) << 6;
  bits |= (code.modules[8][8] ? 1 : 0) << 7;
  bits |= (code.modules[8][7] ? 1 : 0) << 8;
  for (let i = 9; i < 15; i++) {
    bits |= (code.modules[8][14 - i] ? 1 : 0) << i;
  }

  for (let mask = 0; mask < MASK_FUNCTIONS.length; mask++) {
    if (formatBits(mask) === bits) return mask;
  }
  throw new Error(`format bits ${bits.toString(2)} match no mask`);
}

/** Undoes the mask and walks the zigzag back into the codeword stream. */
function readCodewords(code: QrCode, version: number): Uint8Array {
  const reference = createSymbol(version);
  const shouldFlip = MASK_FUNCTIONS[readMask(code)];
  const codewords = new Uint8Array(TOTAL_CODEWORDS[version - 1]);

  let bit = 0;
  let upward = true;
  let right = code.size - 1;

  while (right >= 1) {
    const rightColumn = right === 6 ? 5 : right;
    for (let step = 0; step < code.size; step++) {
      const row = upward ? code.size - 1 - step : step;
      for (let offset = 0; offset < 2; offset++) {
        const col = rightColumn - offset;
        if (reference.reserved[row][col]) continue;
        const dark = code.modules[row][col] !== shouldFlip(row, col);
        if (dark && bit >>> 3 < codewords.length) {
          codewords[bit >>> 3] |= 1 << (7 - (bit & 7));
        }
        bit++;
      }
    }
    right = rightColumn - 2;
    upward = !upward;
  }

  return codewords;
}

/** Reverses the block interleaving and checks each block's error correction. */
function readDataCodewords(codewords: Uint8Array, version: number): Uint8Array {
  const index = version - 1;
  const blockCount = BLOCK_COUNT[index];
  const ecLength = EC_CODEWORDS_PER_BLOCK[index];
  const dataLength = dataCodewordCount(version);
  const shortLength = Math.floor(dataLength / blockCount);
  const longBlocks = dataLength % blockCount;

  const blocks: number[][] = Array.from({ length: blockCount }, () => []);
  let cursor = 0;
  for (let i = 0; i <= shortLength; i++) {
    for (let block = 0; block < blockCount; block++) {
      const length = shortLength + (block >= blockCount - longBlocks ? 1 : 0);
      if (i < length) blocks[block].push(codewords[cursor++]);
    }
  }
  for (let i = 0; i < ecLength; i++) {
    for (let block = 0; block < blockCount; block++) {
      blocks[block].push(codewords[cursor++]);
    }
  }

  for (const block of blocks) {
    expect([...remainder(Uint8Array.from(block), ecLength)]).toEqual(new Array(ecLength).fill(0));
  }

  return Uint8Array.from(blocks.flatMap((block) => block.slice(0, block.length - ecLength)));
}

function decode(code: QrCode): string {
  const version = (code.size - 17) / 4;
  const data = readDataCodewords(readCodewords(code, version), version);

  let cursor = 0;
  const take = (width: number): number => {
    let value = 0;
    for (let i = 0; i < width; i++, cursor++) {
      value = (value << 1) | ((data[cursor >>> 3] >>> (7 - (cursor & 7))) & 1);
    }
    return value;
  };

  expect(take(4)).toBe(0b0100);
  const length = take(characterCountBits(version));
  const bytes = Uint8Array.from({ length }, () => take(8));
  return new TextDecoder().decode(bytes);
}

const SAMPLES = [
  'otpauth://totp/Auth%20Boilerplate:user@example.com?secret=NYITGE7DZ7KUSQJFKLHJL2LZ6Z5IDTV7&issuer=Auth%20Boilerplate&digits=6&period=30',
  'a',
  'https://example.com',
  'otpauth://totp/A:b@c.de?secret=JBSWY3DPEHPK3PXP&issuer=A',
];

describe('QR round trip', () => {
  it.each(SAMPLES)('reads back %s', (text) => {
    const code = encodeQrCode(text);
    expect(code).not.toBeNull();
    expect(decode(code as QrCode)).toBe(text);
  });

  it('reads back a payload that fills each version exactly', () => {
    for (let version = 1; version <= 10; version++) {
      const text = 'Z'.repeat(byteCapacity(version));
      const code = encodeQrCode(text);
      expect(code?.size).toBe(17 + 4 * version);
      expect(decode(code as QrCode)).toBe(text);
    }
  });
});
