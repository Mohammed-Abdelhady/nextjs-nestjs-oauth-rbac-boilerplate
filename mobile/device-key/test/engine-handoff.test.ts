import { Buffer } from 'node:buffer';
import { createHash, createPublicKey, verify } from 'node:crypto';
import type { ClockPort, CryptoPort, TimerPort } from '@app/native-auth';
import { describe, expect, it } from 'vitest';
import { buildDpopProof } from '../../auth/src/proof/dpop-proof';
import { ALIAS, DEVICES, subject } from './subject';
import { fixedKey } from './node-keys';

const crypto: CryptoPort = {
  randomBytes: async (length) => new Uint8Array(length).fill(7),
  sha256: async (bytes) => new Uint8Array(createHash('sha256').update(bytes).digest()),
};
const clock: ClockPort = { wallTime: () => 1_800_000_000_000, monotonicTime: () => 0 };
/** The deadline never fires here. */
const timer: TimerPort = { after: () => () => undefined };

const decode = (part: string | undefined): unknown =>
  JSON.parse(Buffer.from(part ?? '', 'base64url').toString('utf8'));

describe.each(DEVICES)('the engine signing with the key on $platform', (device) => {
  it('builds a proof whose signature Node verifies with the key in its header', async () => {
    const { native, key } = subject(device);
    native.install(ALIAS, fixedKey(device.platform), device.hardware);

    const { proof } = await buildDpopProof({
      crypto,
      clock,
      timer,
      deviceKey: key,
      serverBaseAddress: 'https://api.example.test',
      method: 'post',
      path: '/oauth/token',
    });

    const [header, payload, signature] = proof.split('.');
    expect(decode(header)).toEqual({
      typ: 'dpop+jwt',
      alg: 'ES256',
      jwk: {
        kty: 'EC',
        crv: 'P-256',
        x: 'kEkTQfzZyf-oZboWzbjN20L1Dq7hNYukIyvH3msY394',
        y: 'Dhwd2dUIhY_-YTgJDQNh7VMP7CMF7LhiwZAwaFo17BM',
        alg: 'ES256',
      },
    });
    expect(
      verify(
        'sha256',
        Buffer.from(`${header}.${payload}`),
        {
          key: createPublicKey({
            key: {
              kty: 'EC',
              crv: 'P-256',
              x: 'kEkTQfzZyf-oZboWzbjN20L1Dq7hNYukIyvH3msY394',
              y: 'Dhwd2dUIhY_-YTgJDQNh7VMP7CMF7LhiwZAwaFo17BM',
            },
            format: 'jwk',
          }),
          dsaEncoding: 'ieee-p1363',
        },
        Buffer.from(signature ?? '', 'base64url'),
      ),
    ).toBe(true);
  });
});

describe('the engine meeting a key failure', () => {
  const request = {
    crypto,
    clock,
    timer,
    serverBaseAddress: 'https://api.example.test',
    method: 'POST',
    path: '/oauth/token',
  };

  it('stops the proof as invalidated when the system dropped the key', async () => {
    const { native, key } = subject();
    native.markers.add(ALIAS);

    await expect(buildDpopProof({ ...request, deviceKey: key })).rejects.toMatchObject({
      name: 'DeviceKeyAuthError',
      reason: 'keyInvalidated',
    });
  });

  it('stops the proof as unavailable on a device with no secure hardware', async () => {
    const { key } = subject({ platform: 'android', hardware: 'none' });

    await expect(buildDpopProof({ ...request, deviceKey: key })).rejects.toMatchObject({
      name: 'DeviceKeyAuthError',
      reason: 'unavailable',
    });
  });
});
