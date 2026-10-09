import type { DeviceKeyResult, Es256PublicJwk } from '../../src';
import { SoftwareDeviceKey } from './software-device-key';
import { Deferred } from './support';

/** A device key whose next public key read stays open until the test answers it. */
export class HeldDeviceKey extends SoftwareDeviceKey {
  readonly readStarted = new Deferred<void>();
  private held: Deferred<DeviceKeyResult<Es256PublicJwk>> | undefined;

  holdNextPublicKey(): Deferred<DeviceKeyResult<Es256PublicJwk>> {
    this.held = new Deferred();
    return this.held;
  }

  override async publicKey() {
    const held = this.held;
    if (!held) return super.publicKey();
    this.held = undefined;
    this.publicKeyCalls.push(1);
    this.readStarted.resolve();
    return held.promise;
  }
}
