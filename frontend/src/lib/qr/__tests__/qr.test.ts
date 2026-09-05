import { describe, expect, it } from 'vitest';
import {
  BLOCK_COUNT,
  EC_CODEWORDS_PER_BLOCK,
  QR_MAX_VERSION,
  QR_MIN_VERSION,
  REMAINDER_BITS,
  TOTAL_CODEWORDS,
} from '../tables';
import { buildCodewords, byteCapacity, dataCodewordCount, pickVersion } from '../encode';
import { formatBits, versionBits } from '../format';
import { generatorPolynomial, multiply, remainder } from '../galois';
import { encodeQrCode } from '../index';
import { createSymbol, placeCodewords } from '../patterns';
import { qrPathData, QR_QUIET_ZONE } from '../render';

const VERSIONS = Array.from(
  { length: QR_MAX_VERSION - QR_MIN_VERSION + 1 },
  (_, index) => index + QR_MIN_VERSION,
);

const OTPAUTH_URL =
  'otpauth://totp/Auth%20Boilerplate:user@example.com' +
  '?secret=NYITGE7DZ7KUSQJFKLHJL2LZ6Z5IDTV7&issuer=Auth%20Boilerplate&digits=6&period=30';

function countFreeModules(version: number): number {
  const symbol = createSymbol(version);
  return symbol.reserved.reduce(
    (total, row) => total + row.filter((isReserved) => !isReserved).length,
    0,
  );
}

describe('GF(256) arithmetic', () => {
  it('multiplies as a field: every non-zero element has an inverse', () => {
    for (let value = 1; value < 256; value++) {
      const inverses = [];
      for (let candidate = 1; candidate < 256; candidate++) {
        if (multiply(value, candidate) === 1) inverses.push(candidate);
      }
      expect(inverses).toHaveLength(1);
    }
  });

  it('builds a generator polynomial of the requested degree', () => {
    expect(generatorPolynomial(10)).toHaveLength(10);
    expect(generatorPolynomial(26)).toHaveLength(26);
  });
});

describe('symbol geometry', () => {
  it('is 17 + 4v modules on a side', () => {
    for (const version of VERSIONS) {
      expect(createSymbol(version).size).toBe(17 + 4 * version);
    }
  });

  it('leaves room for exactly the codewords the tables promise', () => {
    for (const version of VERSIONS) {
      const expected = TOTAL_CODEWORDS[version - 1] * 8 + REMAINDER_BITS[version - 1];
      expect({ version, free: countFreeModules(version) }).toEqual({ version, free: expected });
    }
  });

  it('splits the codewords into whole blocks', () => {
    for (const version of VERSIONS) {
      const index = version - 1;
      const used = dataCodewordCount(version) + EC_CODEWORDS_PER_BLOCK[index] * BLOCK_COUNT[index];
      expect(used).toBe(TOTAL_CODEWORDS[index]);
    }
  });

  it('draws the three finder patterns', () => {
    const { modules, size } = createSymbol(4);
    for (const [row, col] of [
      [0, 0],
      [0, size - 1],
      [size - 1, 0],
    ]) {
      expect(modules[row][col]).toBe(true);
    }
    expect(modules[size - 1][size - 1]).toBe(false);
  });

  it('keeps the always-dark module', () => {
    for (const version of VERSIONS) {
      const symbol = createSymbol(version);
      expect(symbol.modules[4 * version + 9][8]).toBe(true);
    }
  });
});

describe('error correction', () => {
  it('divides a codeword block with no remainder', () => {
    for (const version of VERSIONS) {
      const ecLength = EC_CODEWORDS_PER_BLOCK[version - 1];
      const data = Uint8Array.from({ length: 20 }, (_, i) => (i * 37 + version) % 256);
      const check = remainder(Uint8Array.from([...data, ...remainder(data, ecLength)]), ecLength);
      expect([...check]).toEqual(new Array(ecLength).fill(0));
    }
  });

  it('produces a full codeword stream for every version', () => {
    for (const version of VERSIONS) {
      const payload = new Uint8Array(byteCapacity(version)).fill(0x41);
      expect(buildCodewords(payload, version)).toHaveLength(TOTAL_CODEWORDS[version - 1]);
    }
  });
});

describe('format and version information', () => {
  it('matches the published bits for level M', () => {
    expect(formatBits(0)).toBe(0b101010000010010);
    expect(formatBits(4)).toBe(0b100010111111001);
    expect(formatBits(7)).toBe(0b100101010100000);
  });

  it('matches the published version bits', () => {
    expect(versionBits(7)).toBe(0b000111110010010100);
    expect(versionBits(10)).toBe(0b001010010011010011);
  });
});

describe('encodeQrCode', () => {
  it('encodes an otpauth URL', () => {
    const code = encodeQrCode(OTPAUTH_URL);
    expect(code).not.toBeNull();
    expect(code?.size).toBe(code?.modules.length);
    expect(code?.modules.every((row) => row.length === code.size)).toBe(true);
  });

  it('picks the smallest version that fits', () => {
    expect(pickVersion(1)).toBe(1);
    expect(pickVersion(byteCapacity(1))).toBe(1);
    expect(pickVersion(byteCapacity(1) + 1)).toBe(2);
    expect(pickVersion(byteCapacity(QR_MAX_VERSION))).toBe(QR_MAX_VERSION);
  });

  it('returns null rather than truncating an oversized payload', () => {
    expect(encodeQrCode('x'.repeat(byteCapacity(QR_MAX_VERSION) + 1))).toBeNull();
  });

  it('leaves the function patterns alone while masking', () => {
    const code = encodeQrCode(OTPAUTH_URL);
    const reference = createSymbol(code ? (code.size - 17) / 4 : 1);
    expect(code?.modules[6][8]).toBe(reference.modules[6][8]);
    expect(code?.modules[8][6]).toBe(reference.modules[8][6]);
  });

  it('writes every codeword bit into the grid', () => {
    const version = 3;
    const symbol = createSymbol(version);
    const codewords = Uint8Array.from({ length: TOTAL_CODEWORDS[version - 1] }, () => 0xff);
    placeCodewords(symbol, codewords);
    const dark = symbol.modules.flat().filter(Boolean).length;
    const functionDark = createSymbol(version).modules.flat().filter(Boolean).length;
    expect(dark - functionDark).toBe(TOTAL_CODEWORDS[version - 1] * 8);
  });
});

describe('qrPathData', () => {
  it('draws one square per dark module, offset by the quiet zone', () => {
    expect(qrPathData([[true, false]])).toBe(`M${QR_QUIET_ZONE} ${QR_QUIET_ZONE}h1v1h-1z`);
    expect(qrPathData([[false, false]])).toBe('');
  });
});
