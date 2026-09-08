/**
 * Tables for QR symbols in byte mode at error correction level M, versions 1
 * to 10. That range covers otpauth URLs, which run around 140 characters and
 * never come close to the 213 byte ceiling of version 10.
 *
 * Everything else is derived, so a typo here shows up as a failing invariant
 * test rather than an unreadable code.
 */

export const QR_MIN_VERSION = 1;

export const QR_MAX_VERSION = 10;

/** Byte mode. */
export const MODE_INDICATOR = 0b0100;

/** Level M in the two format bits. L is 01, M is 00, Q is 11, H is 10. */
export const EC_LEVEL_BITS = 0b00;

/** Codewords in the whole symbol, indexed by version - 1. */
export const TOTAL_CODEWORDS: readonly number[] = [26, 44, 70, 100, 134, 172, 196, 242, 292, 346];

/** Bits after the last codeword, filled with zeros. Indexed by version - 1. */
export const REMAINDER_BITS: readonly number[] = [0, 7, 7, 7, 7, 7, 0, 0, 0, 0];

/** Error correction codewords per block at level M, indexed by version - 1. */
export const EC_CODEWORDS_PER_BLOCK: readonly number[] = [10, 16, 26, 18, 24, 16, 18, 22, 22, 26];

/** Blocks the codewords split into at level M, indexed by version - 1. */
export const BLOCK_COUNT: readonly number[] = [1, 1, 1, 2, 2, 4, 4, 4, 5, 5];

/**
 * Row and column centres of the alignment patterns, indexed by version - 1.
 * Version 1 has none.
 */
export const ALIGNMENT_CENTRES: readonly (readonly number[])[] = [
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
];

/** Lowest version that carries the 18 bit version block. */
export const MIN_VERSION_WITH_VERSION_INFO = 7;

/** Bytes that pad a data block out to its full length, used in turn. */
export const PAD_BYTES: readonly number[] = [0xec, 0x11];

/** Generator for the BCH(15, 5) code over the format bits. */
export const FORMAT_GENERATOR = 0b101_0011_0111;

/** Mask applied to the format bits so an all-zero format is still readable. */
export const FORMAT_MASK = 0b101_0100_0001_0010;

/** Generator for the BCH(18, 6) code over the version bits. */
export const VERSION_GENERATOR = 0b1_1111_0010_0101;
