import { Model } from 'mongoose';
import { UserDocument } from '../../src/user/schemas/user.schema';
import { SessionIssuanceService } from '../../src/session/services/session-issuance.service';

export async function runForcedIssuanceRace<TFirst, TSecond>(
  issuance: SessionIssuanceService,
  users: Model<UserDocument>,
  firstOperation: () => Promise<TFirst>,
  secondOperation: () => Promise<TSecond>,
): Promise<[PromiseSettledResult<TFirst>, PromiseSettledResult<TSecond>]> {
  const countGate = pauseAfterFirstSessionCount(issuance);
  let userReadGate: ReturnType<typeof pauseNextUserRead> | undefined;
  try {
    const first = firstOperation();
    await countGate.reached;
    userReadGate = pauseNextUserRead(users);
    const second = secondOperation();
    await userReadGate.reached;
    countGate.release();
    userReadGate.release();
    return await Promise.allSettled([first, second]);
  } finally {
    countGate.release();
    userReadGate?.release();
    countGate.restore();
    userReadGate?.restore();
  }
}

function pauseAfterFirstSessionCount(issuance: SessionIssuanceService) {
  let announceReached = () => {};
  let releaseCount = () => {};
  const reached = new Promise<void>((resolve) => {
    announceReached = resolve;
  });
  const blocked = new Promise<void>((resolve) => {
    releaseCount = resolve;
  });
  const assertLimit = issuance.assertSessionLimit.bind(issuance);
  let checks = 0;
  const spy = jest
    .spyOn(issuance, 'assertSessionLimit')
    .mockImplementation(async (session, user, application, now) => {
      await assertLimit(session, user, application, now);
      checks += 1;
      if (checks === 1) {
        announceReached();
        await blocked;
      }
    });

  return {
    reached,
    release: releaseCount,
    restore: () => spy.mockRestore(),
  };
}

function pauseNextUserRead(users: Model<UserDocument>) {
  let announceReached = () => {};
  let releaseRead = () => {};
  const reached = new Promise<void>((resolve) => {
    announceReached = resolve;
  });
  const blocked = new Promise<void>((resolve) => {
    releaseRead = resolve;
  });
  const originalFindById = users.findById.bind(users);
  const spy = jest.spyOn(users, 'findById');
  spy.mockImplementation((...args) => {
    const query = originalFindById(...args);
    const originalExec = query.exec.bind(query);
    jest.spyOn(query, 'exec').mockImplementation(async (...execArgs) => {
      const user = await originalExec(...execArgs);
      announceReached();
      await blocked;
      return user;
    });
    return query;
  });

  return {
    reached,
    release: releaseRead,
    restore: () => spy.mockRestore(),
  };
}
