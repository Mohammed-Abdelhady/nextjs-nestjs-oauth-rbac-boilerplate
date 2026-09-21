import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model } from 'mongoose';
import { randomUUID } from 'crypto';
import { Clock } from '../../common/services/clock';
import {
  SecurityEvent,
  SecurityEventDocument,
} from '../schemas/security-event.schema';
import { SECURITY_EVENT_OUTCOME } from '../constants/security-event-action';

export interface RecordSecurityEventInput {
  actorId?: string;
  targetUserId?: string;
  clientId?: string;
  sessionId?: string;
  action: string;
  reasonCode?: string;
  requestId?: string;
  outcome?: string;
}

@Injectable()
export class SecurityEventService {
  constructor(
    @InjectModel(SecurityEvent.name)
    private readonly eventModel: Model<SecurityEventDocument>,
    private readonly clock: Clock,
  ) {}

  async record(
    input: RecordSecurityEventInput,
    session?: ClientSession,
  ): Promise<void> {
    const occurredAt = this.clock.now();
    await this.eventModel.create(
      [
        {
          eventId: randomUUID(),
          actorId: input.actorId,
          targetUserId: input.targetUserId,
          clientId: input.clientId,
          sessionId: input.sessionId,
          action: input.action,
          reasonCode: input.reasonCode,
          requestId: input.requestId,
          outcome: input.outcome ?? SECURITY_EVENT_OUTCOME.SUCCEEDED,
          occurredAt,
        },
      ],
      session ? { session } : undefined,
    );
  }
}
