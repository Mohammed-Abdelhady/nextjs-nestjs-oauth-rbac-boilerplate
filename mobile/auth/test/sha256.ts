const ROUND_CONSTANTS = Uint32Array.from([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const INITIAL_STATE = Uint32Array.from([
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
]);

export function sha256(bytes: Uint8Array): Uint8Array {
  const padded = pad(bytes);
  const state = Uint32Array.from(INITIAL_STATE);
  const schedule = new Uint32Array(64);
  for (let offset = 0; offset < padded.length; offset += 64) {
    loadSchedule(padded, offset, schedule);
    compress(state, schedule);
  }
  return stateBytes(state);
}

function pad(bytes: Uint8Array): Uint8Array {
  const padded = new Uint8Array(Math.ceil((bytes.length + 9) / 64) * 64);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const bitLength = bytes.length * 8;
  const high = Math.floor(bitLength / 0x1_0000_0000);
  const low = bitLength >>> 0;
  const end = padded.length;
  padded[end - 8] = high >>> 24;
  padded[end - 7] = high >>> 16;
  padded[end - 6] = high >>> 8;
  padded[end - 5] = high;
  padded[end - 4] = low >>> 24;
  padded[end - 3] = low >>> 16;
  padded[end - 2] = low >>> 8;
  padded[end - 1] = low;
  return padded;
}

function loadSchedule(bytes: Uint8Array, offset: number, words: Uint32Array): void {
  for (let index = 0; index < 16; index += 1) {
    const start = offset + index * 4;
    words[index] =
      ((bytes[start] ?? 0) << 24) |
      ((bytes[start + 1] ?? 0) << 16) |
      ((bytes[start + 2] ?? 0) << 8) |
      (bytes[start + 3] ?? 0);
  }
  for (let index = 16; index < 64; index += 1) {
    const left = words[index - 15] ?? 0;
    const right = words[index - 2] ?? 0;
    words[index] =
      ((words[index - 16] ?? 0) +
        smallSigma0(left) +
        (words[index - 7] ?? 0) +
        smallSigma1(right)) >>>
      0;
  }
}

function compress(state: Uint32Array, words: Uint32Array): void {
  let a = state[0] ?? 0;
  let b = state[1] ?? 0;
  let c = state[2] ?? 0;
  let d = state[3] ?? 0;
  let e = state[4] ?? 0;
  let f = state[5] ?? 0;
  let g = state[6] ?? 0;
  let h = state[7] ?? 0;
  for (let index = 0; index < 64; index += 1) {
    const first =
      h + bigSigma1(e) + choose(e, f, g) + (ROUND_CONSTANTS[index] ?? 0) + (words[index] ?? 0);
    const second = bigSigma0(a) + majority(a, b, c);
    h = g;
    g = f;
    f = e;
    e = (d + first) >>> 0;
    d = c;
    c = b;
    b = a;
    a = (first + second) >>> 0;
  }
  state[0] = ((state[0] ?? 0) + a) >>> 0;
  state[1] = ((state[1] ?? 0) + b) >>> 0;
  state[2] = ((state[2] ?? 0) + c) >>> 0;
  state[3] = ((state[3] ?? 0) + d) >>> 0;
  state[4] = ((state[4] ?? 0) + e) >>> 0;
  state[5] = ((state[5] ?? 0) + f) >>> 0;
  state[6] = ((state[6] ?? 0) + g) >>> 0;
  state[7] = ((state[7] ?? 0) + h) >>> 0;
}

function stateBytes(state: Uint32Array): Uint8Array {
  const bytes = new Uint8Array(32);
  for (let index = 0; index < state.length; index += 1) {
    const word = state[index] ?? 0;
    bytes[index * 4] = word >>> 24;
    bytes[index * 4 + 1] = word >>> 16;
    bytes[index * 4 + 2] = word >>> 8;
    bytes[index * 4 + 3] = word;
  }
  return bytes;
}

function choose(x: number, y: number, z: number): number {
  return (x & y) ^ (~x & z);
}

function majority(x: number, y: number, z: number): number {
  return (x & y) ^ (x & z) ^ (y & z);
}

function bigSigma0(value: number): number {
  return rotateRight(value, 2) ^ rotateRight(value, 13) ^ rotateRight(value, 22);
}

function bigSigma1(value: number): number {
  return rotateRight(value, 6) ^ rotateRight(value, 11) ^ rotateRight(value, 25);
}

function smallSigma0(value: number): number {
  return rotateRight(value, 7) ^ rotateRight(value, 18) ^ (value >>> 3);
}

function smallSigma1(value: number): number {
  return rotateRight(value, 17) ^ rotateRight(value, 19) ^ (value >>> 10);
}

function rotateRight(value: number, shift: number): number {
  return (value >>> shift) | (value << (32 - shift));
}
