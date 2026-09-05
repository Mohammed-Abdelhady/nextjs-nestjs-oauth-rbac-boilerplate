/**
 * Arithmetic in GF(256) with the primitive polynomial 0x11D, which is what QR
 * error correction is defined over.
 */

const EXP = new Uint8Array(256);
const LOG = new Uint8Array(256);

for (let i = 0, value = 1; i < 255; i++) {
  EXP[i] = value;
  LOG[value] = i;
  value <<= 1;
  if (value & 0x100) {
    value ^= 0x11d;
  }
}

/** Product of two field elements. Zero absorbs, as in ordinary arithmetic. */
export function multiply(a: number, b: number): number {
  if (a === 0 || b === 0) {
    return 0;
  }
  return EXP[(LOG[a] + LOG[b]) % 255];
}

/**
 * Coefficients of the generator polynomial of the given degree, leading term
 * dropped because it is always 1.
 */
export function generatorPolynomial(degree: number): Uint8Array {
  const coefficients = new Uint8Array(degree);
  coefficients[degree - 1] = 1;

  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      coefficients[j] = multiply(coefficients[j], root);
      if (j + 1 < degree) {
        coefficients[j] ^= coefficients[j + 1];
      }
    }
    root = multiply(root, 0x02);
  }

  return coefficients;
}

/**
 * Remainder of `data` divided by the generator polynomial. For a data block
 * these are its error correction codewords; for a data block followed by its
 * own error correction codewords the result is all zeros.
 */
export function remainder(data: Uint8Array, degree: number): Uint8Array {
  const generator = generatorPolynomial(degree);
  const result = new Uint8Array(degree);

  for (const byte of data) {
    const factor = byte ^ result[0];
    result.copyWithin(0, 1);
    result[degree - 1] = 0;
    for (let i = 0; i < degree; i++) {
      result[i] ^= multiply(generator[i], factor);
    }
  }

  return result;
}

/**
 * Remainder of `value` divided by `generator` in GF(2), used by the BCH codes
 * that protect the format and version bits.
 */
export function bchRemainder(value: number, generator: number): number {
  const generatorWidth = 32 - Math.clz32(generator);
  let result = value;

  while (32 - Math.clz32(result) >= generatorWidth) {
    result ^= generator << (32 - Math.clz32(result) - generatorWidth);
  }

  return result;
}
