import { buildCodewords, pickVersion } from './encode';
import { drawFormatInfo, drawVersionInfo } from './format';
import { MASK_FUNCTIONS, penalty } from './mask';
import { createSymbol, placeCodewords, type QrSymbol } from './patterns';

export { QR_MAX_VERSION, QR_MIN_VERSION } from './tables';
export { byteCapacity, dataCodewordCount, pickVersion } from './encode';
export { formatBits, versionBits } from './format';
export { MASK_FUNCTIONS, penalty } from './mask';
export { createSymbol, placeCodewords } from './patterns';
export type { QrSymbol } from './patterns';
export { qrPathData, QR_QUIET_ZONE } from './render';

/** Light modules the specification asks for around the symbol. */
export interface QrCode {
  /** Modules per side, quiet zone not included. */
  size: number;
  /** Row-major grid where true is a dark module. */
  modules: boolean[][];
}

function withMask(symbol: QrSymbol, mask: number): boolean[][] {
  const masked = symbol.modules.map((row) => [...row]);
  const shouldFlip = MASK_FUNCTIONS[mask];

  for (let row = 0; row < symbol.size; row++) {
    for (let col = 0; col < symbol.size; col++) {
      if (!symbol.reserved[row][col] && shouldFlip(row, col)) {
        masked[row][col] = !masked[row][col];
      }
    }
  }

  return masked;
}

/**
 * Encodes text as a QR symbol in byte mode at error correction level M.
 *
 * Returns null when the text is longer than version 10 holds, which is 213
 * bytes. Callers show the payload as text instead of failing.
 */
export function encodeQrCode(text: string): QrCode | null {
  const bytes = new TextEncoder().encode(text);
  const version = pickVersion(bytes.length);
  if (version === null) {
    return null;
  }

  const symbol = createSymbol(version);
  drawVersionInfo(symbol);
  placeCodewords(symbol, buildCodewords(bytes, version));

  let best: boolean[][] | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let mask = 0; mask < MASK_FUNCTIONS.length; mask++) {
    const candidate: QrSymbol = { ...symbol, modules: withMask(symbol, mask) };
    drawFormatInfo(candidate, mask);

    const score = penalty(candidate.modules);
    if (score < bestScore) {
      bestScore = score;
      best = candidate.modules;
    }
  }

  return best === null ? null : { size: symbol.size, modules: best };
}
