import { Injectable } from '@nestjs/common';
import { ClientSession } from 'mongoose';
import {
  NATIVE_DPOP_REVOKE_PATH,
  NATIVE_DPOP_TOKEN_PATH,
} from '../../constants/session-policy';
import {
  SECURITY_EVENT_ACTION,
  SECURITY_EVENT_OUTCOME,
} from '../../constants/security-event-action';
import { NativeDpopService } from './native-dpop.service';
import type { NativeDpopVerification } from './native-dpop.service';
import { SecurityEventService } from '../../services/security-event.service';

export interface BoundProofEventContext {
  targetUserId?: string;
  sessionId: string;
  clientId: string;
}

@Injectable()
export class NativeBoundProofService {
  constructor(
    private readonly dpop: NativeDpopService,
    private readonly events: SecurityEventService,
  ) {}

  verify(
    proof: string | undefined,
    token: string,
    thumbprint: string,
    endpoint: typeof NATIVE_DPOP_TOKEN_PATH | typeof NATIVE_DPOP_REVOKE_PATH,
    now: Date,
  ): NativeDpopVerification {
    return this.dpop.verifyBoundTokenProof(
      proof,
      token,
      thumbprint,
      endpoint,
      now,
    );
  }

  async reserve(db: ClientSession, jti: string, now: Date): Promise<void> {
    await this.dpop.reserveProofId(db, jti, now);
  }

  async recordRefusal(
    db: ClientSession | undefined,
    context: BoundProofEventContext,
    reason: string,
  ): Promise<void> {
    await this.events.record(
      {
        ...context,
        action: SECURITY_EVENT_ACTION.NATIVE_DPOP_PROOF_REFUSED,
        reasonCode: reason,
        outcome: SECURITY_EVENT_OUTCOME.FAILED,
      },
      db,
    );
  }
}
