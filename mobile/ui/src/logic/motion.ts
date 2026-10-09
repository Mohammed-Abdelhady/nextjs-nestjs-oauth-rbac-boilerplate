interface MotionAnimation {
  start(): void;
  stop(): void;
}

/** Native animations must leave a settled value when a preference changes or their owner unmounts. */
export function runMotion(
  enabled: boolean,
  settle: () => void,
  create: () => MotionAnimation,
): (() => void) | undefined {
  if (!enabled) {
    settle();
    return undefined;
  }
  const animation = create();
  animation.start();
  return () => {
    animation.stop();
    settle();
  };
}
