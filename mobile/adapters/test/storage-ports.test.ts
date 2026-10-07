import { describe, expect, it } from 'vitest';
import { createCredentialsPort } from '../src/ports/credentials';
import { createInstallPort } from '../src/ports/install';
import { FakeMarkerFile, FakeUuid } from './support/fake-modules';
import { FakeSecureStore } from './support/fake-store';

const KEY = 'auth.native-client.test';
const INSTALL_KEY = 'app.install-id';
const OPTIONS = { keychainAccessible: 4 } as const;
const FIRST_ID = '00000000-0000-4000-8000-000000000001';
const SECOND_ID = '00000000-0000-4000-8000-000000000002';

describe('credentials adapter over the secure store', () => {
  it('reads, writes and deletes one key with the keychain options', async () => {
    const store = new FakeSecureStore();
    const port = createCredentialsPort(store, KEY, OPTIONS, new FakeMarkerFile());

    await port.replace('record');
    await port.read();
    await port.delete();

    expect(store.calls).toEqual([
      { call: 'set', key: KEY, options: { keychainAccessible: 4 } },
      { call: 'get', key: KEY, options: { keychainAccessible: 4 } },
      { call: 'delete', key: KEY, options: { keychainAccessible: 4 } },
    ]);
  });

  it('reads an empty stored value as found, not as missing', async () => {
    const store = new FakeSecureStore();
    store.items.set(KEY, '');

    expect(await createCredentialsPort(store, KEY, OPTIONS, new FakeMarkerFile()).read()).toEqual({
      kind: 'found',
      value: '',
    });
  });

  it('leaves another key alone', async () => {
    const store = new FakeSecureStore();
    store.items.set('auth.other-client.test', 'theirs');
    const port = createCredentialsPort(store, KEY, OPTIONS, new FakeMarkerFile());

    expect(await port.read()).toEqual({ kind: 'missing' });
    await port.delete();

    expect(store.items.get('auth.other-client.test')).toBe('theirs');
  });
});

describe('install adapter over the keychain and a marker file', () => {
  function setup() {
    const store = new FakeSecureStore();
    const marker = new FakeMarkerFile();
    const port = createInstallPort({ store, marker, uuid: new FakeUuid() }, INSTALL_KEY, OPTIONS);
    return { store, marker, port };
  }

  it('makes an id on the first start, stores it device-only and marks the install', async () => {
    const { store, marker, port } = setup();

    expect(await port.identity()).toEqual({ kind: 'found', id: FIRST_ID });
    expect(store.items.get(INSTALL_KEY)).toBe(FIRST_ID);
    expect(store.calls).toEqual([
      { call: 'set', key: INSTALL_KEY, options: { keychainAccessible: 4 } },
    ]);
    expect(marker.present).toBe(true);
  });

  it('returns the stored id on later starts', async () => {
    const { port } = setup();
    await port.identity();

    expect(await port.identity()).toEqual({ kind: 'found', id: FIRST_ID });
  });

  it('makes a new id after a reinstall, when the keychain kept the old one', async () => {
    const { marker, store, port } = setup();
    await port.identity();
    marker.present = false;

    expect(await port.identity()).toEqual({ kind: 'found', id: SECOND_ID });
    expect(store.items.get(INSTALL_KEY)).toBe(SECOND_ID);
    expect(marker.present).toBe(true);
  });

  it('makes a new id when a backup brought the marker to a device without the id', async () => {
    const { marker, store, port } = setup();
    marker.present = true;

    expect(await port.identity()).toEqual({ kind: 'found', id: FIRST_ID });
    expect(store.items.get(INSTALL_KEY)).toBe(FIRST_ID);
  });

  it('treats an empty stored id as no id', async () => {
    const { marker, store, port } = setup();
    marker.present = true;
    store.items.set(INSTALL_KEY, '');

    expect(await port.identity()).toEqual({ kind: 'found', id: FIRST_ID });
  });

  it('reports a locked keychain as locked and keeps the stored id', async () => {
    const { store, port } = setup();
    await port.identity();
    store.readFailure = 'User interaction is not allowed.';

    expect(await port.identity()).toEqual({ kind: 'locked' });
    expect(store.items.get(INSTALL_KEY)).toBe(FIRST_ID);
  });

  it('reports a keychain that is out of reach as unavailable, not as locked', async () => {
    const { store, port } = setup();
    await port.identity();
    store.readFailure = 'No keychain is available. You may need to restart your computer.';

    expect(await port.identity()).toEqual({ kind: 'unavailable' });
  });

  it('reports locked when the first id cannot be written to a locked keychain', async () => {
    const { store, marker, port } = setup();
    store.writeFailure = 'User interaction is not allowed.';

    expect(await port.identity()).toEqual({ kind: 'locked' });
    expect(marker.present).toBe(false);
  });

  it('reports a failed write as unavailable and does not mark the install', async () => {
    const { store, marker, port } = setup();
    store.failNextSet = true;

    expect(await port.identity()).toEqual({ kind: 'unavailable' });
    expect(marker.present).toBe(false);
  });

  it('reports an unreadable marker as unavailable without touching the keychain', async () => {
    const { store, marker, port } = setup();
    marker.unreadable = true;

    expect(await port.identity()).toEqual({ kind: 'unavailable' });
    expect(store.calls).toEqual([]);
  });

  it('gives two first reads at once the same id', async () => {
    const { store, port } = setup();

    const [first, second] = await Promise.all([port.identity(), port.identity()]);

    expect(first).toEqual({ kind: 'found', id: FIRST_ID });
    expect(second).toEqual({ kind: 'found', id: FIRST_ID });
    expect(store.calls.filter(({ call }) => call === 'set')).toHaveLength(1);
  });
});
