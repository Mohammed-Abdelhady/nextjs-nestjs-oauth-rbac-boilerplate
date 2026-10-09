import { Types } from 'mongoose';
import { AuthEpochService } from '../../../../src/common/services/auth-epoch.service';
import { AuthorityApplications } from '../../../../src/session/authority/authority-applications';
import { SessionAuthorityStore } from '../../../../src/session/authority/session-authority.store';
import { SessionValidator } from '../../../../src/session/authority/session-validator';
import { MongoUnitOfWorkRunner } from '../../../../src/session/persistence/mongo/mongo-unit-of-work';
import { SessionRevocationStore } from '../../../../src/session/revocation/session-revocation.store';
import { SessionRevoker } from '../../../../src/session/revocation/session-revoker';
import { REFUSED_EVENT_SEED_ACTION } from '../../transaction-failure';
import { bootMongoIssuance } from '../issuance-contract/mongo-issuance-harness';
import {
  ACCOUNT_TAKEN_AT,
  AuthorityContractHarness,
} from './authority-contract-harness';

const A_UUID = '018f4d2e-7b1a-7c3d-9e2f-0a1b2c3d4e5f';

export async function bootMongoAuthorityHarness(): Promise<AuthorityContractHarness> {
  const {
    harness: issuance,
    booted,
    events,
  } = await bootMongoIssuance('authority_contract');
  const { app, users, sessions, grants, connection } = booted;
  const authorityStore = app.get(SessionAuthorityStore);
  const authorityApplications = app.get(AuthorityApplications);
  const revocationStore = app.get(SessionRevocationStore);
  const authEpoch = app.get(AuthEpochService);

  return {
    issuance,
    accountTakenAt: ACCOUNT_TAKEN_AT.FIRST_WRITE,
    authorityStore,
    authorityApplications,
    revocationStore,
    validator: () =>
      new SessionValidator(
        authorityStore,
        authorityApplications,
        issuance.clock,
        authEpoch,
      ),
    revoker: (pause) =>
      new SessionRevoker(
        new MongoUnitOfWorkRunner(connection, pause),
        revocationStore,
        issuance.clock,
      ),

    session: async (sessionId) => {
      const stored = await sessions.findById(sessionId).lean().exec();
      return stored
        ? {
            isValid: stored.isValid,
            revokedAt: stored.revokedAt ?? null,
            revokedReason: stored.revokedReason ?? null,
            userVersion: stored.userVersion,
            idleExpiresAt: stored.idleExpiresAt,
            lastActivityAt: stored.lastActivityAt,
            lastUsedAt: stored.lastUsedAt ?? null,
          }
        : null;
    },
    patchSession: async (sessionId, patch) => {
      await sessions.updateOne({ _id: sessionId }, { $set: patch });
    },
    patchGrant: async (userId, clientId, patch) => {
      await grants.updateOne(
        { userId: new Types.ObjectId(userId), clientId },
        { $set: patch },
      );
    },
    removeGrant: async (userId, clientId) => {
      await grants.deleteOne({ userId: new Types.ObjectId(userId), clientId });
    },
    markAccountDeleted: async (userId) => {
      await users.updateOne(
        { _id: new Types.ObjectId(userId) },
        { $set: { isDeleted: true } },
      );
    },
    events: async () => {
      const stored = await events
        .find({ action: { $ne: REFUSED_EVENT_SEED_ACTION } })
        .sort({ _id: 1 })
        .lean()
        .exec();
      return stored.map((event) => ({
        action: event.action,
        actorId: event.actorId ?? null,
        targetUserId: event.targetUserId ?? null,
        clientId: event.clientId ?? null,
        sessionId: event.sessionId ?? null,
        reasonCode: event.reasonCode ?? null,
      }));
    },
    absentSessionId: () => new Types.ObjectId().toString(),
    foreignSessionId: () => A_UUID,
  };
}
