import { describe, expect, it } from 'vitest';
import { createEpochTracker } from '../src/state/epoch';
import { uiApi } from '../src/state/api';
import { signedInAs, SIGNED_OUT } from './support/fake-engine';
import { ROUTE, session, sessionList, settle } from './support/fake-server';
import { createSubject } from './support/ui';

describe('the cache follows the signed-in account', () => {
  it("never hands the next person the previous person's sessions", async () => {
    const subject = createSubject(signedInAs('ada'));
    await subject.load([session('ada-phone', { isCurrent: true }), session('ada-laptop')]);
    expect(subject.shown()).toEqual(['ada-phone', 'ada-laptop']);

    subject.fake.publish(SIGNED_OUT);
    const afterSignOut = subject.shown();
    subject.fake.publish(signedInAs('ben'));
    const beforeBenLoads = subject.shown();
    await subject.load([session('ben-tablet', { isCurrent: true })]);

    expect({ afterSignOut, beforeBenLoads, afterBenLoads: subject.shown() }).toEqual({
      afterSignOut: undefined,
      beforeBenLoads: undefined,
      afterBenLoads: ['ben-tablet'],
    });
  });

  it('drops an answer that arrives after the account changed', async () => {
    const subject = createSubject(signedInAs('ada'));
    void subject.runtime.store.dispatch(uiApi.endpoints.listSessions.initiate());
    await settle();

    subject.fake.publish(SIGNED_OUT);
    subject.fake.publish(signedInAs('ben'));
    subject.server.answer(ROUTE.SESSIONS, sessionList([session('ada-laptop')]));
    await settle();

    expect(subject.shown()).toBeUndefined();
  });

  it("keeps the new person's list when the old answer lands while theirs is loading", async () => {
    const subject = createSubject(signedInAs('ada'));
    void subject.runtime.store.dispatch(uiApi.endpoints.listSessions.initiate());
    await settle();
    subject.fake.publish(SIGNED_OUT);
    subject.fake.publish(signedInAs('ben'));
    void subject.runtime.store.dispatch(uiApi.endpoints.listSessions.initiate());
    await settle();

    subject.server.answer(ROUTE.SESSIONS, sessionList([session('ada-laptop')]));
    await settle();
    const whileBenLoads = subject.shown();
    subject.server.answer(ROUTE.SESSIONS, sessionList([session('ben-tablet')]));
    await settle();

    expect({ whileBenLoads, afterBenLoads: subject.shown() }).toEqual({
      whileBenLoads: undefined,
      afterBenLoads: ['ben-tablet'],
    });
  });

  it('forgets how the last sign-in attempt ended once someone is signed in', async () => {
    const subject = createSubject(SIGNED_OUT);
    subject.runtime.signIn.run('signIn');
    subject.fake.signIns[0]?.resolve({ kind: 'cancelled' });
    await settle();

    subject.fake.publish(signedInAs('ada'));

    expect(subject.runtime.signIn.getState()).toEqual({ pending: false });
  });
});

describe('what starts a new epoch', () => {
  it('counts sign-out and sign-in, and nothing in between', () => {
    const epoch = createEpochTracker(signedInAs('ada'));
    const seen = [
      epoch.observe({
        status: 'signedIn',
        operation: 'refreshing',
        profile: signedInAs('ada').profile,
      }),
      epoch.observe({ status: 'signedOut', operation: 'signingOut' }),
      epoch.observe(SIGNED_OUT),
      epoch.observe({ status: 'signedOut', operation: 'authorizing' }),
      epoch.observe(signedInAs('ben')),
    ];

    expect({ seen, epoch: epoch.current() }).toEqual({
      seen: [false, true, false, false, true],
      epoch: 2,
    });
  });

  it('counts a different account that appears without a sign-out', () => {
    const epoch = createEpochTracker(signedInAs('ada'));

    expect([epoch.observe(signedInAs('ben')), epoch.current()]).toEqual([true, 1]);
  });

  it('does not count a restored session whose profile arrives later', () => {
    const epoch = createEpochTracker({ status: 'signedIn', operation: 'none' });

    expect([epoch.observe(signedInAs('ada')), epoch.current()]).toEqual([false, 0]);
  });

  it('remembers the account across a snapshot that carries no profile', () => {
    const epoch = createEpochTracker(signedInAs('ada'));
    epoch.observe({ status: 'signedIn', operation: 'refreshing' });

    expect(epoch.observe(signedInAs('ben'))).toBe(true);
  });
});
