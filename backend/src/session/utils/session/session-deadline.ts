export function isDeadlinePassed(now: Date, deadline: Date): boolean {
  return now.getTime() >= deadline.getTime();
}

export function minDate(left: Date, right: Date): Date {
  return left.getTime() <= right.getTime() ? left : right;
}

export function addMs(start: Date, ms: number): Date {
  return new Date(start.getTime() + ms);
}

export function effectiveDeadline(stored: Date, policyCap: Date): Date {
  return minDate(stored, policyCap);
}

export function capIdleByAbsolute(idle: Date, absolute: Date): Date {
  return minDate(idle, absolute);
}
