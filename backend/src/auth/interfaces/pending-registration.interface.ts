import { Types } from 'mongoose';
import { PendingPurpose } from '../constants/registration';

/**
 * A pending code record as stored. Kept for callers that describe the shape
 * without importing the Mongoose document.
 */
export interface PendingRegistration {
  email: string;
  purpose: PendingPurpose;
  userId?: Types.ObjectId;
  addressGeneration?: number;
  hashedCode: string;
  attempts: number;
  expiresAt: Date;
}
