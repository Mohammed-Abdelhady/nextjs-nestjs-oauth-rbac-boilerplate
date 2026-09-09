import { ALIGNMENT_CENTRES, MIN_VERSION_WITH_VERSION_INFO } from './tables';

/**
 * A symbol under construction. `reserved` marks every module the function
 * patterns own, which is what keeps the codewords and the mask off them.
 */
export interface QrSymbol {
  version: number;
  size: number;
  modules: boolean[][];
  reserved: boolean[][];
}

function grid(size: number): boolean[][] {
  return Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
}

function set(symbol: QrSymbol, row: number, col: number, dark: boolean): void {
  symbol.modules[row][col] = dark;
  symbol.reserved[row][col] = true;
}

/** The 7x7 eye plus the light separator around it, clipped to the symbol. */
function drawFinder(symbol: QrSymbol, centreRow: number, centreCol: number): void {
  for (let dRow = -4; dRow <= 4; dRow++) {
    for (let dCol = -4; dCol <= 4; dCol++) {
      const row = centreRow + dRow;
      const col = centreCol + dCol;
      if (row < 0 || row >= symbol.size || col < 0 || col >= symbol.size) {
        continue;
      }
      const ring = Math.max(Math.abs(dRow), Math.abs(dCol));
      set(symbol, row, col, ring !== 2 && ring !== 4);
    }
  }
}

/** The 5x5 alignment pattern, skipped where a finder already sits. */
function drawAlignmentPatterns(symbol: QrSymbol): void {
  const centres = ALIGNMENT_CENTRES[symbol.version - 1];
  const last = centres.length - 1;

  for (let i = 0; i < centres.length; i++) {
    for (let j = 0; j < centres.length; j++) {
      const onFinder = (i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0);
      if (onFinder) {
        continue;
      }
      for (let dRow = -2; dRow <= 2; dRow++) {
        for (let dCol = -2; dCol <= 2; dCol++) {
          const ring = Math.max(Math.abs(dRow), Math.abs(dCol));
          set(symbol, centres[i] + dRow, centres[j] + dCol, ring !== 1);
        }
      }
    }
  }
}

function drawTimingPatterns(symbol: QrSymbol): void {
  for (let i = 0; i < symbol.size; i++) {
    if (!symbol.reserved[6][i]) {
      set(symbol, 6, i, i % 2 === 0);
    }
    if (!symbol.reserved[i][6]) {
      set(symbol, i, 6, i % 2 === 0);
    }
  }
}

/**
 * Holds the 15 format bits, written once a mask has been picked. Index 6 is
 * left alone in both directions because the timing patterns run through it.
 */
function reserveFormatAreas(symbol: QrSymbol): void {
  const last = symbol.size - 1;

  for (let i = 0; i <= 8; i++) {
    if (i !== 6) {
      set(symbol, 8, i, false);
      set(symbol, i, 8, false);
    }
  }
  for (let i = 0; i < 8; i++) {
    set(symbol, 8, last - i, false);
    set(symbol, last - i, 8, false);
  }

  // The one module that is always dark, just above the lower format copy.
  set(symbol, 4 * symbol.version + 9, 8, true);
}

/** Reserves the two 6x3 version blocks. Their bits are written separately. */
function reserveVersionAreas(symbol: QrSymbol): void {
  if (symbol.version < MIN_VERSION_WITH_VERSION_INFO) {
    return;
  }

  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 3; col++) {
      set(symbol, row, symbol.size - 11 + col, false);
      set(symbol, symbol.size - 11 + col, row, false);
    }
  }
}

/** A symbol with every function pattern in place and nothing else. */
export function createSymbol(version: number): QrSymbol {
  const size = 4 * version + 17;
  const symbol: QrSymbol = {
    version,
    size,
    modules: grid(size),
    reserved: grid(size),
  };

  drawFinder(symbol, 3, 3);
  drawFinder(symbol, 3, size - 4);
  drawFinder(symbol, size - 4, 3);
  drawAlignmentPatterns(symbol);
  drawTimingPatterns(symbol);
  reserveFormatAreas(symbol);
  reserveVersionAreas(symbol);

  return symbol;
}

/**
 * Walks the free modules in the two-column zigzag the specification defines,
 * bottom right first, and writes the codeword bits into them.
 */
export function placeCodewords(symbol: QrSymbol, codewords: Uint8Array): void {
  let bit = 0;
  let upward = true;
  let right = symbol.size - 1;

  while (right >= 1) {
    // Column 6 is the vertical timing pattern, so the pair slides past it.
    const rightColumn = right === 6 ? 5 : right;

    for (let step = 0; step < symbol.size; step++) {
      const row = upward ? symbol.size - 1 - step : step;

      for (let offset = 0; offset < 2; offset++) {
        const col = rightColumn - offset;
        if (symbol.reserved[row][col]) {
          continue;
        }
        const byte = codewords[bit >>> 3];
        symbol.modules[row][col] = byte !== undefined && ((byte >>> (7 - (bit & 7))) & 1) === 1;
        bit++;
      }
    }

    right = rightColumn - 2;
    upward = !upward;
  }
}
