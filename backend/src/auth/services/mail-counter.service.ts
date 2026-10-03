import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  MailCounter,
  MailCounterDocument,
} from '../schemas/mail-counter.schema';
import { Clock } from '../../common/services/clock';
import { isMongoDuplicateKeyError } from '../../common/utils/mongo-error.util';
import { PENDING_STORE_PASSES } from '../constants/pending-store';
import {
  ACTIVATION_CODE_EXPIRES_IN_DEFAULT,
  MAILED_CODE_LIMIT_PER_ADDRESS,
  MailCounterPurpose,
  mailedCodeWindowMs,
} from '../constants/registration';

/**
 * Caps every per-address mail with its own counter, keyed by address and
 * purpose. The counter is separate from the code record and keeps its own
 * window, so no code record deletion can reset it. The window is derived from
 * the configured code lifetime so no configuration can switch the cap off.
 */
@Injectable()
export class MailCounterService {
  private readonly windowMs: number;

  constructor(
    @InjectModel(MailCounter.name)
    private readonly mailCounterModel: Model<MailCounterDocument>,
    private readonly configService: ConfigService,
    private readonly clock: Clock,
  ) {
    this.windowMs = mailedCodeWindowMs(
      this.configService.get<number>(
        'activation.codeExpiresIn',
        ACTIVATION_CODE_EXPIRES_IN_DEFAULT,
      ),
    );
  }

  /** True when this mail is under the cap and may be sent. */
  async tryRecord(
    email: string,
    purpose: MailCounterPurpose,
  ): Promise<boolean> {
    const now = this.clock.now();
    const windowRolledOver = {
      $gte: [{ $subtract: [now, '$windowStartedAt'] }, this.windowMs],
    };

    for (let pass = 0; pass < PENDING_STORE_PASSES; pass += 1) {
      const updated = await this.mailCounterModel.findOneAndUpdate(
        {
          email: { $eq: email },
          purpose,
          $or: [
            {
              windowStartedAt: {
                $lte: new Date(now.getTime() - this.windowMs),
              },
            },
            { mailedCodes: { $lt: MAILED_CODE_LIMIT_PER_ADDRESS } },
          ],
        },
        [
          {
            $set: {
              mailedCodes: {
                $cond: [windowRolledOver, 1, { $add: ['$mailedCodes', 1] }],
              },
              windowStartedAt: {
                $cond: [windowRolledOver, now, '$windowStartedAt'],
              },
            },
          },
        ],
        { new: true, select: '_id' },
      );
      if (updated) {
        return true;
      }

      const existing = await this.mailCounterModel.exists({
        email: { $eq: email },
        purpose,
      });
      if (existing) {
        return false;
      }

      try {
        await this.mailCounterModel.create({
          email,
          purpose,
          mailedCodes: 1,
          windowStartedAt: now,
        });
        return true;
      } catch (error) {
        if (!isMongoDuplicateKeyError(error)) throw error;
      }
    }

    return false;
  }
}
