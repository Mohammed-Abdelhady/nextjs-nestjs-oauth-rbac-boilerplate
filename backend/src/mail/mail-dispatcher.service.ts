import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { currentRequestId } from '../common/context/request-context';
import { MailService } from './mail.service';
import {
  MAIL_DRAIN_DEADLINE_LOG,
  MAIL_DRAIN_DEADLINE_MS,
  MAIL_MAX_PENDING_SENDS,
} from './constants/mail.constants';

/**
 * Starts mail sends without putting the SMTP round trip on the response path.
 * A deferred send is tracked so shutdown can drain it, a failure is logged
 * with the request id exactly as the awaited path does, and no rejection can
 * escape. The pending set is bounded, so a caller that has already been
 * answered cannot leave an unbounded number of connections behind. On shutdown
 * it drains under the named deadline, then closes the pooled transporter.
 */
@Injectable()
export class MailDispatcherService implements OnApplicationShutdown {
  private readonly logger = new Logger(MailDispatcherService.name);
  private readonly pending = new Set<Promise<void>>();
  private readonly maxPending: number;
  private readonly drainDeadlineMs: number;

  constructor(
    configService: ConfigService,
    private readonly mailService: MailService,
  ) {
    this.maxPending = configService.get<number>(
      'mail.maxPendingSends',
      MAIL_MAX_PENDING_SENDS,
    );
    this.drainDeadlineMs = configService.get<number>(
      'mail.drainDeadlineMs',
      MAIL_DRAIN_DEADLINE_MS,
    );
  }

  /**
   * Start a send and return at once. The failure message is logged with the
   * request id captured here, because the request context is gone by the time
   * a slow send fails. Above the pending bound the send is dropped, and the
   * caller's answer is unchanged.
   */
  dispatch(action: () => Promise<void>, failureMessage: string): void {
    const requestId = currentRequestId() ?? 'unknown';
    if (this.pending.size >= this.maxPending) {
      this.logger.error(
        `${failureMessage} requestId=${requestId} cause=MailQueueFull`,
      );
      return;
    }

    const tracked = action().catch((error: unknown) => {
      const cause = error instanceof Error ? error.name : typeof error;
      this.logger.error(
        `${failureMessage} requestId=${requestId} cause=${cause}`,
      );
    });
    this.pending.add(tracked);
    void tracked.finally(() => {
      this.pending.delete(tracked);
    });
  }

  /** Await every in-flight send. Tests call this before reading mail. */
  async flush(): Promise<void> {
    while (this.pending.size > 0) {
      await Promise.allSettled([...this.pending]);
    }
  }

  /** Drain in-flight sends on shutdown, then close the pooled transporter. */
  async onApplicationShutdown(): Promise<void> {
    if (this.pending.size > 0) {
      await Promise.race([
        this.flush(),
        new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, this.drainDeadlineMs);
          timer.unref();
        }),
      ]);
      if (this.pending.size > 0) {
        this.logger.error(
          `${MAIL_DRAIN_DEADLINE_LOG} with ${this.pending.size} sends still pending`,
        );
      }
    }

    this.mailService.closeTransport();
  }
}
