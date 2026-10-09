import type { User } from '@app/sdk';
import type { AuthProfile, AuthSnapshot } from '../types/auth';

export function freezeSnapshot(snapshot: AuthSnapshot): AuthSnapshot {
  const profile = snapshot.profile ? freezeUser(snapshot.profile) : undefined;
  const frozen: AuthSnapshot = {
    status: snapshot.status,
    operation: snapshot.operation,
    ...(snapshot.reason === undefined ? {} : { reason: snapshot.reason }),
    ...(snapshot.warning === undefined ? {} : { warning: snapshot.warning }),
    ...(profile === undefined ? {} : { profile }),
  };
  return Object.freeze(frozen);
}

export function sameSnapshot(left: AuthSnapshot, right: AuthSnapshot): boolean {
  return (
    left.status === right.status &&
    left.operation === right.operation &&
    left.reason === right.reason &&
    left.warning === right.warning &&
    left.profile === right.profile
  );
}

function freezeUser(user: AuthProfile | User): AuthProfile {
  return Object.freeze({
    ...user,
    permissions: Object.freeze([...user.permissions]),
    linkedProviders: Object.freeze([...user.linkedProviders]),
  });
}
