import { Types } from 'mongoose';

/** The configured lifetime a refreshed or replaced code gets. */
export interface CodeWindow {
  codeExpiresIn: number;
}

interface PipelineInput {
  hashedCode: string;
  now: Date;
  window: CodeWindow;
  userId?: Types.ObjectId;
  addressGeneration?: number;
}

/**
 * The live record a refresh may touch: not expired yet. The per-address mail
 * cap is counted by the mail counter, not here, so a refresh is not filtered
 * on it.
 */
export function buildRefreshFilter(
  email: string,
  purpose: string,
  now: Date,
): Record<string, unknown> {
  return {
    email: { $eq: email },
    purpose,
    expiresAt: { $gt: now },
  };
}

/** The expired record a registration may replace with fresh details. */
export function buildReplaceFilter(
  email: string,
  purpose: string,
  now: Date,
): Record<string, unknown> {
  return {
    email: { $eq: email },
    purpose,
    expiresAt: { $lte: now },
  };
}

/**
 * The pipeline that refreshes a live record: new code, attempts reset, expiry
 * one code lifetime ahead. An email-change refresh also re-points the record at
 * the current user and address generation, so a move away and back cannot leave
 * a code bound to a superseded generation.
 */
export function buildRefreshPipeline(
  input: PipelineInput,
): Record<string, unknown>[] {
  const set: Record<string, unknown> = {
    // A bcrypt hash starts with "$", which a pipeline would read as a field
    // path; $literal keeps it a value.
    hashedCode: { $literal: input.hashedCode },
    attempts: 0,
    expiresAt: new Date(input.now.getTime() + input.window.codeExpiresIn),
  };
  if (input.userId) {
    set.userId = input.userId;
    set.addressGeneration = input.addressGeneration ?? 0;
  }
  return [{ $set: set }];
}

/** The pipeline that replaces an expired record with fresh details. */
export function buildReplaceUpdate(
  input: PipelineInput,
): Record<string, unknown>[] {
  const set: Record<string, unknown> = {
    hashedCode: { $literal: input.hashedCode },
    attempts: 0,
    expiresAt: new Date(input.now.getTime() + input.window.codeExpiresIn),
  };
  if (input.userId) {
    set.userId = input.userId;
    set.addressGeneration = input.addressGeneration ?? 0;
  }
  return [{ $set: set }];
}
