import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import { randomUUID } from 'crypto';
import { Clock } from '../../common/services/clock';
import {
  SecurityEvent,
  SecurityEventDocument,
} from '../schemas/security-event.schema';
import {
  ROLE_DELETION_EVENT_PREFIX,
  SECURITY_EVENT_ACTION,
  SECURITY_EVENT_OUTCOME,
} from '../constants/security-event-action';
import { RoleDeletionSweep } from '../types/role-deletion-sweep';
import { LINEARIZABLE_QUERY_MAX_TIME_MS } from '../constants/session-policy';
import { RoleAssignmentEvent } from '../types/role-assignment-event';

export interface RecordSecurityEventInput {
  actorId?: string;
  targetUserId?: string;
  clientId?: string;
  sessionId?: string;
  action: string;
  reasonCode?: string;
  requestId?: string;
  outcome?: string;
  roleAssignment?: RoleAssignmentEvent;
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
      [this.buildEvent(input, occurredAt)],
      session ? { session } : undefined,
    );
  }

  /**
   * Record many events in one round trip. A role-wide revocation can touch
   * thousands of holders, and one insert per holder would blow the
   * transaction's lifetime; a single insertMany keeps it bounded.
   */
  async recordMany(
    inputs: RecordSecurityEventInput[],
    session?: ClientSession,
  ): Promise<void> {
    if (inputs.length === 0) {
      return;
    }
    const occurredAt = this.clock.now();
    const documents = inputs.map((input) => this.buildEvent(input, occurredAt));
    if (session) {
      await this.eventModel.insertMany(documents, { session });
    } else {
      await this.eventModel.insertMany(documents);
    }
  }

  async recordRoleDeletion(
    ref: Omit<RoleDeletionSweep, 'pending'>,
    session: ClientSession,
  ): Promise<void> {
    await this.eventModel.create(
      [
        {
          ...this.buildEvent(
            {
              action: SECURITY_EVENT_ACTION.ROLE_DELETED,
              actorId: ref.actorId,
            },
            this.clock.now(),
          ),
          eventId: `${ROLE_DELETION_EVENT_PREFIX}${ref.roleId}`,
          roleDeletionSweep: { ...ref, pending: true },
        },
      ],
      { session },
    );
  }

  async roleDeletionSweep(
    roleId: Types.ObjectId,
    session: ClientSession,
  ): Promise<RoleDeletionSweep | undefined> {
    const event = await this.eventModel
      .findOne({
        eventId: `${ROLE_DELETION_EVENT_PREFIX}${roleId.toString()}`,
      })
      .session(session)
      .exec();
    return event?.roleDeletionSweep;
  }

  async pendingRoleDeletions(limit: number): Promise<RoleDeletionSweep[]> {
    const events = await this.eventModel
      .find({
        eventId: { $regex: `^${ROLE_DELETION_EVENT_PREFIX}` },
        'roleDeletionSweep.pending': true,
      })
      .limit(limit)
      .maxTimeMS(LINEARIZABLE_QUERY_MAX_TIME_MS)
      .lean()
      .exec();
    return events.flatMap((event) =>
      event.roleDeletionSweep ? [event.roleDeletionSweep] : [],
    );
  }

  async completeRoleDeletionSweep(roleId: Types.ObjectId): Promise<void> {
    await this.eventModel
      .updateOne(
        {
          eventId: `${ROLE_DELETION_EVENT_PREFIX}${roleId.toString()}`,
          'roleDeletionSweep.pending': true,
        },
        { $set: { 'roleDeletionSweep.pending': false } },
      )
      .exec();
  }

  /** Read each holder's assignment history using the existing target-user index. */
  async previousRoleIdsForAssignment(
    userIds: Types.ObjectId[],
    assignedRoleId: Types.ObjectId,
    session: ClientSession,
  ): Promise<Map<string, Types.ObjectId>> {
    const history = await this.eventModel
      .aggregate<{ _id: string; assignment: RoleAssignmentEvent }>([
        {
          $match: {
            targetUserId: { $in: userIds.map((id) => id.toString()) },
            roleAssignment: { $exists: true },
          },
        },
        { $sort: { 'roleAssignment.sessionVersion': -1, _id: -1 } },
        {
          $group: {
            _id: '$targetUserId',
            assignment: { $first: '$roleAssignment' },
          },
        },
      ])
      .session(session)
      .exec();
    const previous = new Map<string, Types.ObjectId>();
    for (const event of history) {
      if (event.assignment.assignedRoleId !== assignedRoleId.toString())
        continue;
      const roleId = event.assignment.previousRoleId;
      if (roleId && Types.ObjectId.isValid(roleId)) {
        previous.set(event._id, new Types.ObjectId(roleId));
      }
    }
    return previous;
  }

  private buildEvent(
    input: RecordSecurityEventInput,
    occurredAt: Date,
  ): Record<string, unknown> {
    return {
      eventId: randomUUID(),
      actorId: input.actorId,
      targetUserId: input.targetUserId,
      clientId: input.clientId,
      sessionId: input.sessionId,
      action: input.action,
      reasonCode: input.reasonCode,
      requestId: input.requestId,
      roleAssignment: input.roleAssignment,
      outcome: input.outcome ?? SECURITY_EVENT_OUTCOME.SUCCEEDED,
      occurredAt,
    };
  }
}
