/**
 * @param {{ budgetMs: number, capture: (signal: AbortSignal) => Promise<void>,
 * cancel: () => Promise<void>, captureLimitMs?: number, reserveMs?: number,
 * minimumMs?: number, cleanupLimitMs?: number }} options
 */
export async function runFailureDiagnostics({
  budgetMs,
  capture,
  cancel,
  captureLimitMs = 5000,
  reserveMs = 1000,
  minimumMs = 250,
  cleanupLimitMs = 250,
}) {
  const captureMs = Math.min(captureLimitMs, budgetMs - reserveMs);
  if (!Number.isFinite(captureMs) || captureMs < minimumMs) return 'skipped';
  const controller = new AbortController();
  let timer;
  const operation = Promise.resolve()
    .then(() => capture(controller.signal))
    .then(
      () => 'completed',
      () => 'failed',
    );
  const deadline = new Promise((resolve) => {
    timer = setTimeout(() => resolve('timed-out'), captureMs);
  });
  const result = await Promise.race([operation, deadline]);
  clearTimeout(timer);
  if (result === 'completed') return result;
  controller.abort();
  // The caller closes its failed page to interrupt pending browser commands.
  // Cancellation itself must never hold up the already-recorded test failure.
  let cleanupTimer;
  await Promise.race([
    Promise.resolve()
      .then(cancel)
      .catch(() => undefined),
    new Promise((resolve) => {
      cleanupTimer = setTimeout(resolve, Math.min(cleanupLimitMs, reserveMs / 2));
    }),
  ]);
  clearTimeout(cleanupTimer);
  return result;
}
