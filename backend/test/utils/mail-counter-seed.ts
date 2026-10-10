import type { Model } from 'mongoose';
import type { MailCounter } from '../../src/auth/persistence/mongo/schemas/mail-counter.schema';
import {
  ACTIVATION_CODE_EXPIRES_IN_DEFAULT,
  MailCounterPurpose,
  mailedCodeWindowMs,
} from '../../src/auth/constants/registration';
import { TEST_NOW } from './frozen-clock';

export interface MailCounterSeed {
  email: string;
  purpose: MailCounterPurpose;
  mailedCodes: number;
  /** Defaults to the frozen test clock. */
  windowStartedAt?: Date;
  /** The configured code lifetime the service under test runs with. */
  codeExpiresIn?: number;
}

/**
 * Seeds a counter the way the service writes one: the expiry is the window
 * start plus the window derived from the code lifetime.
 */
export async function seedMailCounter(
  counters: Model<MailCounter>,
  seed: MailCounterSeed,
): Promise<void> {
  const windowStartedAt = seed.windowStartedAt ?? TEST_NOW;
  const windowMs = mailedCodeWindowMs(
    seed.codeExpiresIn ?? ACTIVATION_CODE_EXPIRES_IN_DEFAULT,
  );
  await counters.create({
    email: seed.email,
    purpose: seed.purpose,
    mailedCodes: seed.mailedCodes,
    windowStartedAt,
    expiresAt: new Date(windowStartedAt.getTime() + windowMs),
  });
}
