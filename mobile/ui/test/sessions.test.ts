import { ErrorCode } from '@app/core';
import { describe, expect, it } from 'vitest';
import { revokeOtherSessions, revokeSession } from '../src/state/session-actions';
import { deferred, signedInAs, SIGNED_OUT } from './support/fake-engine';
import {
  noResponse,
  ok,
  refusal,
  ROUTE,
  session,
  sessionList,
  settle,
} from './support/fake-server';
import { createSubject, type Subject } from './support/ui';

const PHONE = session('phone', { isCurrent: true, credentialPurpose: 'native_access' });
const LAPTOP = session('laptop');
const TABLET = session('tablet');

async function loaded(): Promise<Subject> {
  const subject = createSubject(signedInAs('ada'));
  await subject.load([PHONE, LAPTOP, TABLET]);
  return subject;
}

describe('signing one device out', () => {
  it('removes the row before the server answers and asks the server for that session', async () => {
    const subject = await loaded();

    void revokeSession(subject.runtime, LAPTOP);
    await settle();

    expect({ shown: subject.shown(), sent: subject.server.sent().at(-1) }).toEqual({
      shown: ['phone', 'tablet'],
      sent: ROUTE.revoke('laptop'),
    });
  });

  it('puts the row back where it was when the server refuses', async () => {
    const subject = await loaded();

    const result = revokeSession(subject.runtime, LAPTOP);
    await settle();
    subject.server.answer(ROUTE.revoke('laptop'), refusal(403, ErrorCode.FORBIDDEN));

    expect(await result).toBe('undone');
    expect(subject.shown()).toEqual(['phone', 'laptop', 'tablet']);
  });

  it('puts the row back when no answer arrives', async () => {
    const subject = await loaded();

    const result = revokeSession(subject.runtime, LAPTOP);
    await settle();
    subject.server.fail(ROUTE.revoke('laptop'), noResponse());

    expect(await result).toBe('undone');
    expect(subject.shown()).toEqual(['phone', 'laptop', 'tablet']);
  });

  it('leaves the row out when the server says the session had already ended', async () => {
    const subject = await loaded();

    const result = revokeSession(subject.runtime, LAPTOP);
    await settle();
    subject.server.answer(ROUTE.revoke('laptop'), refusal(404, ErrorCode.SESSION_NOT_FOUND));

    expect(await result).toBe('revoked');
    expect(subject.shown()).toEqual(['phone', 'tablet']);
  });

  it('reads the list again from the server after the session ends', async () => {
    const subject = await loaded();

    const result = revokeSession(subject.runtime, LAPTOP);
    await settle();
    subject.server.answer(ROUTE.revoke('laptop'), ok({ message: 'done' }));
    await result;
    await settle();
    subject.server.answer(ROUTE.SESSIONS, sessionList([PHONE]));
    await settle();

    expect(subject.shown()).toEqual(['phone']);
  });

  it('signs out through the engine for this device and sends no revoke', async () => {
    const subject = await loaded();

    const result = await revokeSession(subject.runtime, PHONE);

    expect({ result, signOuts: subject.fake.signOuts, sent: subject.server.sent() }).toEqual({
      result: 'signedOut',
      signOuts: 1,
      sent: [ROUTE.SESSIONS],
    });
  });

  it("leaves the next person's list alone when the account changes mid-request", async () => {
    const subject = await loaded();
    const result = revokeOtherSessions(subject.runtime);
    await settle();

    subject.fake.publish(SIGNED_OUT);
    subject.fake.publish(signedInAs('ben'));
    await subject.load([session('ben-tablet', { isCurrent: true }), session('ben-laptop')]);

    expect(await result).toBe('superseded');
    await settle();
    expect(subject.shown()).toEqual(['ben-tablet', 'ben-laptop']);
  });

  it("does not put a refused row into the next person's list", async () => {
    const subject = await loaded();
    const result = revokeSession(subject.runtime, LAPTOP);
    await settle();

    subject.fake.publish(SIGNED_OUT);
    subject.fake.publish(signedInAs('ben'));
    await subject.load([session('ben-tablet', { isCurrent: true })]);
    subject.server.answer(ROUTE.revoke('laptop'), refusal(403, ErrorCode.FORBIDDEN));

    expect(await result).toBe('superseded');
    await settle();
    expect(subject.shown()).toEqual(['ben-tablet']);
  });
});

describe('signing every other device out', () => {
  it('keeps only this device while the server works', async () => {
    const subject = await loaded();

    void revokeOtherSessions(subject.runtime);
    await settle();

    expect({ shown: subject.shown(), sent: subject.server.sent().at(-1) }).toEqual({
      shown: ['phone'],
      sent: ROUTE.REVOKE_OTHERS,
    });
  });

  it('puts every row back when the server refuses', async () => {
    const subject = await loaded();

    const result = revokeOtherSessions(subject.runtime);
    await settle();
    subject.server.answer(ROUTE.REVOKE_OTHERS, refusal(429, ErrorCode.RATE_LIMIT_EXCEEDED));

    expect(await result).toBe('undone');
    expect(subject.shown()).toEqual(['phone', 'laptop', 'tablet']);
  });

  it('reports success when the server ends them', async () => {
    const subject = await loaded();

    const result = revokeOtherSessions(subject.runtime);
    await settle();
    subject.server.answer(ROUTE.REVOKE_OTHERS, ok({ revokedCount: 2 }));

    expect(await result).toBe('revoked');
    expect(subject.shown()).toEqual(['phone']);
  });
});

describe('session write races', () => {
  it('blocks a second write until the first settles, then accepts a new tap', async () => {
    const subject = await loaded();
    const first = revokeSession(subject.runtime, LAPTOP);
    await settle();
    const second = revokeSession(subject.runtime, TABLET);
    const all = revokeOtherSessions(subject.runtime);
    await settle();
    expect(subject.server.sent()).toEqual([ROUTE.SESSIONS, ROUTE.revoke('laptop')]);
    expect(await second).toBe('busy');
    expect(await all).toBe('busy');
    expect(subject.server.sent()).toEqual([ROUTE.SESSIONS, ROUTE.revoke('laptop')]);
    subject.server.answer(ROUTE.revoke('laptop'), refusal(403, ErrorCode.FORBIDDEN));
    expect(await first).toBe('undone');
    expect(subject.shown()).toEqual(['phone', 'laptop', 'tablet']);
    const next = revokeSession(subject.runtime, TABLET);
    await settle();
    subject.server.answer(ROUTE.revoke('tablet'), ok({ message: 'done' }));
    expect(await next).toBe('revoked');
  });

  it.each(['one', 'others'] as const)(
    'drops a %s confirmation after the account changes',
    async (kind) => {
      const subject = await loaded();
      const answer = deferred<boolean>();
      const confirm = () => answer.promise;
      const pending =
        kind === 'one'
          ? revokeSession(subject.runtime, LAPTOP, confirm)
          : revokeOtherSessions(subject.runtime, confirm);
      subject.fake.publish(SIGNED_OUT);
      subject.fake.publish(signedInAs('ben'));
      answer.resolve(true);
      await settle();
      expect(subject.server.sent()).toEqual([ROUTE.SESSIONS]);
      expect(await pending).toBe('superseded');
    },
  );

  it('sends no write when confirmation is declined', async () => {
    const subject = await loaded();
    const result = revokeSession(subject.runtime, LAPTOP, () => Promise.resolve(false));
    await settle();
    expect(subject.server.sent()).toEqual([ROUTE.SESSIONS]);
    expect(await result).toBe('cancelled');
    expect(subject.server.sent()).toEqual([ROUTE.SESSIONS]);
  });
});
