import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'vitest';
import { ALIAS, storedPublicJwk, subject, valueOf } from './subject';
import { nativeError } from './support';
import { fixedKey } from './node-keys';

const DATA = new Uint8Array(Buffer.from('header.payload'));
const KEY_X = 'kEkTQfzZyf-oZboWzbjN20L1Dq7hNYukIyvH3msY394';

describe('a key the system no longer has', () => {
  it('reports a key lost behind its marker once, then creates a new one', async () => {
    const { native, key } = subject();
    const before = valueOf(await key.publicKey());
    native.loseKey(ALIAS);

    expect(await key.publicKey()).toEqual({ kind: 'keyInvalidated' });
    expect(native.count('generateKeyAsync')).toBe(1);
    expect([...native.markers]).toEqual([]);

    const after = valueOf(await key.publicKey());
    expect(native.count('generateKeyAsync')).toBe(2);
    expect(after).toEqual(storedPublicJwk(native, ALIAS));
    expect(after.x).not.toBe(before.x);
  });

  it('reports a restored backup that carries the marker and not the key', async () => {
    const { native, key } = subject();
    native.markers.add(ALIAS);

    expect(await key.prepare()).toEqual({ kind: 'keyInvalidated' });
    expect(native.count('generateKeyAsync')).toBe(0);
    expect(await key.prepare()).toEqual({ kind: 'ready', protection: 'secureEnclave' });
  });

  it('reports a signature asked of a key that is gone and never makes one to sign with', async () => {
    const { native, key } = subject();
    await key.publicKey();
    native.loseKey(ALIAS);

    expect(await key.sign(DATA)).toEqual({ kind: 'keyInvalidated' });
    expect(native.count('generateKeyAsync')).toBe(1);
    expect([...native.markers]).toEqual([]);
  });

  it('removes a key the system refuses to use and reports it', async () => {
    const { native, key } = subject({ platform: 'android', hardware: 'trustedEnvironment' });
    native.install(ALIAS, fixedKey('android'), 'trustedEnvironment');
    native.markers.add(ALIAS);
    native.invalidate(ALIAS);

    expect(await key.sign(DATA)).toEqual({ kind: 'keyInvalidated' });
    expect([...native.keys.keys()]).toEqual([]);
    expect([...native.markers]).toEqual([]);

    const fresh = valueOf(await key.publicKey());
    expect(fresh).toEqual(storedPublicJwk(native, ALIAS));
    expect(fresh.x).not.toBe(KEY_X);
  });

  it('reports invalidation while reading the key the same way', async () => {
    const { native, key } = subject();
    native.install(ALIAS, fixedKey('ios'), 'secureEnclave');
    native.markers.add(ALIAS);
    native.failNext('getKeyAsync', 'ERR_DEVICE_KEY_INVALIDATED');

    expect(await key.publicKey()).toEqual({ kind: 'keyInvalidated' });
    expect([...native.keys.keys()]).toEqual([]);
  });
});

describe('a key the system cannot reach right now', () => {
  it.each(['getKeyAsync', 'getMarkerAsync', 'generateKeyAsync'] as const)(
    'reports unavailable when %s fails and leaves nothing behind',
    async (method) => {
      const { native, key } = subject();
      native.failNext(method);

      expect(await key.publicKey()).toEqual({ kind: 'unavailable' });
      expect([...native.keys.keys()]).toEqual([]);
      expect([...native.markers]).toEqual([]);
      expect(await key.prepare()).toEqual({ kind: 'ready', protection: 'secureEnclave' });
    },
  );

  it('keeps the key and its marker when a read or a signature fails for now', async () => {
    const { native, key } = subject();
    native.install(ALIAS, fixedKey('ios'), 'secureEnclave');
    native.markers.add(ALIAS);
    native.failNext('getKeyAsync');
    native.failNext('signAsync');

    expect(await key.publicKey()).toEqual({ kind: 'unavailable' });
    expect(await key.sign(DATA)).toEqual({ kind: 'unavailable' });
    expect(native.count('deleteKeyAsync')).toBe(0);
    expect([...native.markers]).toEqual([ALIAS]);
    expect(valueOf(await key.publicKey()).x).toBe(KEY_X);
  });

  it.each([
    ['an error with a code it does not know', nativeError('ERR_SOMETHING_ELSE')],
    ['an error with no code', new Error('ERR_DEVICE_KEY_INVALIDATED')],
    ['a value that is not an error', 'ERR_DEVICE_KEY_NOT_FOUND'],
  ])('treats %s as unavailable and keeps the key', async (_name, error) => {
    const { native, key } = subject();
    native.install(ALIAS, fixedKey('ios'), 'secureEnclave');
    native.signAsync = () => Promise.reject(error);

    expect(await key.sign(DATA)).toEqual({ kind: 'unavailable' });
    expect([...native.keys.keys()]).toEqual([ALIAS]);
  });

  it('still hands out a new key when its marker cannot be written, and writes it later', async () => {
    const { native, key } = subject();
    native.failNext('setMarkerAsync');

    const first = await key.publicKey();
    expect(first).toEqual({ kind: 'success', value: storedPublicJwk(native, ALIAS) });
    expect([...native.markers]).toEqual([]);

    expect(await key.publicKey()).toEqual(first);
    expect([...native.markers]).toEqual([ALIAS]);
    expect(native.count('generateKeyAsync')).toBe(1);
  });
});

describe('an answer the platform could not have meant', () => {
  it.each([
    ['a public key that is not base64', { publicKey: '***', protection: 'secureEnclave' }],
    ['a public key of the wrong size', { publicKey: 'Zm9v', protection: 'secureEnclave' }],
    ['a protection it does not know', { publicKey: 'Zm9v', protection: 'vault' }],
  ])('reports %s as unavailable and keeps the key', async (_name, record) => {
    const { native, key } = subject();
    native.install(ALIAS, fixedKey('ios'), 'secureEnclave');
    native.recordOverride = record;

    expect(await key.publicKey()).toEqual({ kind: 'unavailable' });
    expect([...native.keys.keys()]).toEqual([ALIAS]);
    expect(valueOf(await key.publicKey()).x).toBe(KEY_X);
  });

  it.each([
    ['text that is not base64', '***'],
    ['bytes that are not a DER signature', Buffer.from('not a signature').toString('base64')],
    // A raw signature is what the engine wants, and never what a platform returns.
    ['a signature that is already raw', Buffer.alloc(64, 1).toString('base64')],
  ])('reports %s as unavailable', async (_name, answer) => {
    const { native, key } = subject();
    native.install(ALIAS, fixedKey('ios'), 'secureEnclave');
    native.signatureOverride = answer;

    expect(await key.sign(DATA)).toEqual({ kind: 'unavailable' });
    expect([...native.keys.keys()]).toEqual([ALIAS]);
  });

  it('sends the bytes it was given, also when they are a view into a larger buffer', async () => {
    const { native, key } = subject();
    native.install(ALIAS, fixedKey('ios'), 'secureEnclave');
    const sent: string[] = [];
    const signAsync = native.signAsync.bind(native);
    native.signAsync = (alias, data) => {
      sent.push(data);
      return signAsync(alias, data);
    };
    const larger = new Uint8Array(Buffer.from('xxheader.payloadxx'));

    await key.sign(larger.subarray(2, 16));

    // "header.payload" in padded base64.
    expect(sent).toEqual(['aGVhZGVyLnBheWxvYWQ=']);
  });
});
