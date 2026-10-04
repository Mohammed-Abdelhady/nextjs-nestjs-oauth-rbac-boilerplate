import { Logger } from '@nestjs/common';
import { RoleSweepBootstrapService } from './services/role-sweep-bootstrap.service';
import { ROLE_SWEEP_BOOTSTRAP_FINISHED } from '../common/constants/roles';
import { RaceGate } from '../../test/utils/race-gate';

// Observe background completion before requesting lifecycle shutdown.
export async function finishBootstrap(
  instances: RoleSweepBootstrapService[],
  onFinished?: () => void,
): Promise<void> {
  const done = new RaceGate();
  const log = jest
    .spyOn(Logger.prototype, 'debug')
    .mockImplementation((entry: unknown) => {
      if (
        typeof entry === 'object' &&
        entry !== null &&
        'event' in entry &&
        entry.event === ROLE_SWEEP_BOOTSTRAP_FINISHED
      ) {
        onFinished?.();
        void done.hold();
      }
    });
  try {
    for (const instance of instances) instance.onApplicationBootstrap();
    await done.reached(instances.length);
  } finally {
    done.release();
    await Promise.all(
      instances.map((instance) => instance.onApplicationShutdown()),
    );
    log.mockRestore();
  }
}
