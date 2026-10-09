import type { FakeKey, FakeKeySource } from './fake-native';

const HEX_RADIX = 16;

function fromHex(text: string): Uint8Array {
  return Uint8Array.from({ length: text.length / 2 }, (_, index) =>
    Number.parseInt(text.slice(index * 2, index * 2 + 2), HEX_RADIX),
  );
}

/** Two real P-256 public keys. The second has an x that starts with a zero byte. */
export const CANNED_COORDINATES_HEX = [
  {
    x: '90491341fcd9c9ffa865ba16cdb8cddb42f50eaee1358ba4232bc7de6b18dfde',
    y: '0e1c1dd9d508858ffe6138090d0361ed530fec2305ecb862c19030685a35ec13',
  },
  {
    x: '0006f525bfcfd6e4b30e6339e85d77525d64fdfffb061729b7dde5b1d83f2a4d',
    y: '2905f1ead8aede157c1d676e52f9565dbf3cb17433e6255f9a4b75647dcc3a37',
  },
] as const;

/** A well-formed DER signature. It is valid for one message only, never for the data given. */
export const CANNED_SIGNATURE_HEX =
  '3044' +
  '0220' +
  '1d4bc20dfb56293843d1e16d08bc8030f86908ce5874f6bb8595ece67eb944ea' +
  '0220' +
  '745e956a82c8c93b69793d4de0fb85838ff294f6dc797aeaaa4efa5691559a7c';

/**
 * Keys for a test that needs the port to answer and does not check signatures,
 * such as a shell test with no server. It hands out the two keys in turn, as
 * the X9.63 point iOS exports.
 */
export function cannedKeySource(): FakeKeySource {
  let created = 0;
  return {
    create(): FakeKey {
      const { x, y } =
        CANNED_COORDINATES_HEX[created % CANNED_COORDINATES_HEX.length] ??
        CANNED_COORDINATES_HEX[0];
      created += 1;
      return { publicKey: fromHex(`04${x}${y}`), sign: () => fromHex(CANNED_SIGNATURE_HEX) };
    },
  };
}
