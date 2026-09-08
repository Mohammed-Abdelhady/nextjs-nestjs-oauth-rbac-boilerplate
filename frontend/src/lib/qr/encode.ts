import {
  BLOCK_COUNT,
  EC_CODEWORDS_PER_BLOCK,
  MODE_INDICATOR,
  PAD_BYTES,
  QR_MAX_VERSION,
  QR_MIN_VERSION,
  TOTAL_CODEWORDS,
} from './tables';
import { remainder } from './galois';

/** Codewords a symbol carries once error correction is taken out. */
export function dataCodewordCount(version: number): number {
  const index = version - 1;
  return TOTAL_CODEWORDS[index] - EC_CODEWORDS_PER_BLOCK[index] * BLOCK_COUNT[index];
}

/** Width of the character count field. Byte mode widens it at version 10. */
export function characterCountBits(version: number): number {
  return version < 10 ? 8 : 16;
}

/** Payload bytes a version holds after the mode and character count fields. */
export function byteCapacity(version: number): number {
  const bits = dataCodewordCount(version) * 8 - 4 - characterCountBits(version);
  return Math.floor(bits / 8);
}

/** Smallest version that holds `byteLength` bytes, or null when none does. */
export function pickVersion(byteLength: number): number | null {
  for (let version = QR_MIN_VERSION; version <= QR_MAX_VERSION; version++) {
    if (byteCapacity(version) >= byteLength) {
      return version;
    }
  }
  return null;
}

function pushBits(bits: number[], value: number, width: number): void {
  for (let shift = width - 1; shift >= 0; shift--) {
    bits.push((value >>> shift) & 1);
  }
}

/** Mode, length, payload, terminator and padding, as one array of data bytes. */
function buildDataCodewords(bytes: Uint8Array, version: number): Uint8Array {
  const capacity = dataCodewordCount(version) * 8;
  const bits: number[] = [];

  pushBits(bits, MODE_INDICATOR, 4);
  pushBits(bits, bytes.length, characterCountBits(version));
  for (const byte of bytes) {
    pushBits(bits, byte, 8);
  }

  const terminator = Math.min(4, capacity - bits.length);
  pushBits(bits, 0, terminator);
  pushBits(bits, 0, (8 - (bits.length % 8)) % 8);

  const codewords = new Uint8Array(dataCodewordCount(version));
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let offset = 0; offset < 8; offset++) {
      byte = (byte << 1) | bits[i + offset];
    }
    codewords[i / 8] = byte;
  }

  for (let i = bits.length / 8; i < codewords.length; i++) {
    codewords[i] = PAD_BYTES[(i - bits.length / 8) % PAD_BYTES.length];
  }

  return codewords;
}

/** Splits the data codewords into the blocks the version calls for. */
function splitIntoBlocks(codewords: Uint8Array, version: number): Uint8Array[] {
  const blockCount = BLOCK_COUNT[version - 1];
  const shortLength = Math.floor(codewords.length / blockCount);
  const longBlocks = codewords.length % blockCount;

  const blocks: Uint8Array[] = [];
  let offset = 0;
  for (let i = 0; i < blockCount; i++) {
    const length = shortLength + (i >= blockCount - longBlocks ? 1 : 0);
    blocks.push(codewords.subarray(offset, offset + length));
    offset += length;
  }

  return blocks;
}

/**
 * The full codeword stream of a symbol: data blocks interleaved column by
 * column, then the error correction blocks the same way.
 */
export function buildCodewords(bytes: Uint8Array, version: number): Uint8Array {
  const ecLength = EC_CODEWORDS_PER_BLOCK[version - 1];
  const dataBlocks = splitIntoBlocks(buildDataCodewords(bytes, version), version);
  const ecBlocks = dataBlocks.map((block) => remainder(block, ecLength));

  const result = new Uint8Array(TOTAL_CODEWORDS[version - 1]);
  let cursor = 0;

  const longestBlock = Math.max(...dataBlocks.map((block) => block.length));
  for (let i = 0; i < longestBlock; i++) {
    for (const block of dataBlocks) {
      if (i < block.length) {
        result[cursor++] = block[i];
      }
    }
  }

  for (let i = 0; i < ecLength; i++) {
    for (const block of ecBlocks) {
      result[cursor++] = block[i];
    }
  }

  return result;
}
