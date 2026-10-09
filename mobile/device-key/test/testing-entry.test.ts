import { describe, expect, it } from 'vitest';
import { createDeviceKey } from '../src';
import * as entry from '../src';
import { cannedKeySource, FakeDeviceKeyNative } from './support';
import { SETTINGS, valueOf } from './subject';
import { SIGNATURE_VECTORS, toHex } from './vectors';

describe('the fake a shell imports', () => {
  it('answers through the port with keys that need no Node', async () => {
    const native = new FakeDeviceKeyNative({ hardware: 'secureEnclave', keys: cannedKeySource() });
    const key = createDeviceKey(native, SETTINGS);

    expect(valueOf(await key.publicKey())).toEqual({
      kty: 'EC',
      crv: 'P-256',
      x: 'kEkTQfzZyf-oZboWzbjN20L1Dq7hNYukIyvH3msY394',
      y: 'Dhwd2dUIhY_-YTgJDQNh7VMP7CMF7LhiwZAwaFo17BM',
      alg: 'ES256',
    });
    expect(toHex(valueOf(await key.sign(new Uint8Array([1, 2, 3]))))).toBe(
      SIGNATURE_VECTORS[0].raw,
    );
  });

  it('hands out a different key after a delete', async () => {
    const native = new FakeDeviceKeyNative({ hardware: 'strongBox', keys: cannedKeySource() });
    const key = createDeviceKey(native, SETTINGS);
    await key.publicKey();
    await key.delete();

    expect(valueOf(await key.publicKey()).x).toBe('AAb1Jb_P1uSzDmM56F13Ul1k_f_7Bhcpt93lsdg_Kk0');
  });

  it('stays out of the main entry', () => {
    expect('FakeDeviceKeyNative' in entry).toBe(false);
    expect(entry.NATIVE_MODULE_NAME).toBe('AppDeviceKey');
  });
});
