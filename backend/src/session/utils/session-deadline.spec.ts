import { addMs, isDeadlinePassed, minDate } from './session-deadline';

describe('session deadlines', () => {
  const start = new Date('2026-09-21T00:00:00.000Z');

  it('treats the exact deadline as expired', () => {
    const deadline = addMs(start, 1000);
    expect(isDeadlinePassed(deadline, deadline)).toBe(true);
    expect(isDeadlinePassed(addMs(deadline, -1), deadline)).toBe(false);
    expect(isDeadlinePassed(addMs(deadline, 1), deadline)).toBe(true);
  });

  it('returns the earlier of two dates', () => {
    const later = addMs(start, 50);
    expect(minDate(start, later).getTime()).toBe(start.getTime());
    expect(minDate(later, start).getTime()).toBe(start.getTime());
  });
});
