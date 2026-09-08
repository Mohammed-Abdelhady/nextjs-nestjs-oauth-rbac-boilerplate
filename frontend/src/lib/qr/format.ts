import {
  EC_LEVEL_BITS,
  FORMAT_GENERATOR,
  FORMAT_MASK,
  MIN_VERSION_WITH_VERSION_INFO,
  VERSION_GENERATOR,
} from './tables';
import { bchRemainder } from './galois';
import type { QrSymbol } from './patterns';

function bitAt(value: number, index: number): boolean {
  return ((value >>> index) & 1) === 1;
}

/** The 15 protected bits that tell a reader the level and the mask. */
export function formatBits(mask: number): number {
  const data = (EC_LEVEL_BITS << 3) | mask;
  return ((data << 10) | bchRemainder(data << 10, FORMAT_GENERATOR)) ^ FORMAT_MASK;
}

/** The 18 protected bits that tell a reader the version. */
export function versionBits(version: number): number {
  return (version << 12) | bchRemainder(version << 12, VERSION_GENERATOR);
}

/**
 * Writes both copies of the format information. The layout is irregular
 * because the timing patterns and the dark module sit in the middle of it.
 */
export function drawFormatInfo(symbol: QrSymbol, mask: number): void {
  const bits = formatBits(mask);
  const last = symbol.size - 1;

  for (let i = 0; i <= 5; i++) {
    symbol.modules[i][8] = bitAt(bits, i);
  }
  symbol.modules[7][8] = bitAt(bits, 6);
  symbol.modules[8][8] = bitAt(bits, 7);
  symbol.modules[8][7] = bitAt(bits, 8);
  for (let i = 9; i < 15; i++) {
    symbol.modules[8][14 - i] = bitAt(bits, i);
  }

  for (let i = 0; i < 8; i++) {
    symbol.modules[8][last - i] = bitAt(bits, i);
  }
  for (let i = 8; i < 15; i++) {
    symbol.modules[symbol.size - 15 + i][8] = bitAt(bits, i);
  }
}

/** Writes both copies of the version block. Versions below 7 carry none. */
export function drawVersionInfo(symbol: QrSymbol): void {
  if (symbol.version < MIN_VERSION_WITH_VERSION_INFO) {
    return;
  }

  const bits = versionBits(symbol.version);
  for (let i = 0; i < 18; i++) {
    const dark = bitAt(bits, i);
    const far = symbol.size - 11 + (i % 3);
    const near = Math.floor(i / 3);
    symbol.modules[near][far] = dark;
    symbol.modules[far][near] = dark;
  }
}
