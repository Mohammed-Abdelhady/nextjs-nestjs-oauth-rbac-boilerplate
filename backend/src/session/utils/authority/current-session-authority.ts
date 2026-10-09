import { FilterQuery, Types } from 'mongoose';
import { AUTH_SCHEMA_VERSION } from '../../constants/session-policy';
import { CredentialPurpose } from '../../constants/credential-purpose';
import { Session } from '../../schemas/session.schema';

export {
  currentSessionDeadlines,
  isValidDate,
  type EffectiveSessionDeadlines,
} from './session-authority-rule';

export function currentSessionCandidateFilter(
  userId: Types.ObjectId,
  now: Date,
  userVersion: number,
  authEpoch: number,
  credentialPurposes: CredentialPurpose[],
): FilterQuery<Session> {
  return {
    user: userId,
    isValid: true,
    revokedAt: null,
    expiresAt: { $gt: now, $type: 'date' },
    idleExpiresAt: { $gt: now, $type: 'date' },
    authenticatedAt: { $type: 'date' },
    lastActivityAt: { $type: 'date' },
    clientId: { $type: 'string', $ne: '' },
    clientVersion: { $type: 'number' },
    grantVersion: { $type: 'number' },
    credentialPurpose: { $in: credentialPurposes },
    authEpoch,
    schemaVersion: AUTH_SCHEMA_VERSION,
    userVersion,
  };
}
