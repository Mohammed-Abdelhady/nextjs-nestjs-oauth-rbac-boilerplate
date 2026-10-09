import type { AuthSnapshot } from '@app/native-auth';

type IdentityInput = Pick<AuthSnapshot, 'status' | 'operation' | 'profile'>;

interface Identity {
  live: boolean;
  userId: string | undefined;
}

export interface EpochTracker {
  /** Rises each time the signed-in account starts, ends or changes. */
  current(): number;
  /** Reads a snapshot and answers whether it began a new epoch. */
  observe(snapshot: IdentityInput): boolean;
}

function identityOf(snapshot: IdentityInput): Identity {
  return {
    live: snapshot.status === 'signedIn' && snapshot.operation !== 'signingOut',
    userId: snapshot.profile?.id,
  };
}

/** A restored session has no profile yet, so a missing id is not a different account. */
function differs(previous: Identity, next: Identity): boolean {
  if (previous.live !== next.live) return true;
  return (
    previous.userId !== undefined && next.userId !== undefined && previous.userId !== next.userId
  );
}

export function createEpochTracker(initial: IdentityInput): EpochTracker {
  let epoch = 0;
  let identity = identityOf(initial);
  return {
    current: () => epoch,
    observe(snapshot) {
      const next = identityOf(snapshot);
      const changed = differs(identity, next);
      identity = {
        live: next.live,
        userId: next.userId ?? (changed ? undefined : identity.userId),
      };
      if (changed) epoch += 1;
      return changed;
    },
  };
}
