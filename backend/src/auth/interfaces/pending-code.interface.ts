import { Types } from 'mongoose';
import { PendingPurpose } from '../constants/registration';

/** The plain code to mail, or null when the address is over its cap. */
export interface IssuedCode {
  code: string;
}

/** What a pending record carries once its code compared successfully. */
export interface ReservedCode {
  id: Types.ObjectId;
  email: string;
  purpose: PendingPurpose;
  hashedCode: string;
  userId?: Types.ObjectId;
  addressGeneration?: number;
}

/** Target user and generation, for an email-change record only. */
export interface RegistrationDetails {
  userId?: Types.ObjectId;
  addressGeneration?: number;
}

/** Outcome of a live-record refresh. */
export type RefreshOutcome =
  | { kind: 'refreshed'; issued: IssuedCode }
  | { kind: 'limited' }
  | { kind: 'none' };
