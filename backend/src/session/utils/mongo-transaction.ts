import { ClientSession, Connection } from 'mongoose';

const MAX_TRANSACTION_ATTEMPTS = 3;

export function hasErrorLabel(error: unknown, label: string): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const labels = (error as { errorLabels?: unknown }).errorLabels;
  return Array.isArray(labels) && labels.includes(label);
}

export function isTransientTransactionError(error: unknown): boolean {
  return (
    hasErrorLabel(error, 'TransientTransactionError') ||
    isCatalogRetry(error, new Set())
  );
}

function isCatalogRetry(error: unknown, seen: Set<unknown>): boolean {
  if (typeof error !== 'object' || error === null || seen.has(error)) {
    return false;
  }
  seen.add(error);
  const message = error instanceof Error ? error.message : '';
  if (
    message.includes('catalog changes') ||
    message.includes('Please retry your operation')
  ) {
    return true;
  }
  const cause = (error as { cause?: unknown }).cause;
  return isCatalogRetry(cause, seen);
}

export async function withMajorityTransaction<T>(
  connection: Connection,
  work: (session: ClientSession) => Promise<T>,
): Promise<T> {
  const session = await connection.startSession();
  try {
    let lastError: unknown;
    for (let attempt = 0; attempt < MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
      try {
        session.startTransaction({
          writeConcern: { w: 'majority' },
          readPreference: 'primary',
        });
        const result = await work(session);
        await session.commitTransaction();
        return result;
      } catch (error) {
        if (session.inTransaction()) {
          try {
            await session.abortTransaction();
          } catch (abortError) {
            if (!(error instanceof Error)) {
              throw abortError;
            }
          }
        }
        lastError = error;
        const canRetry =
          isTransientTransactionError(error) &&
          attempt < MAX_TRANSACTION_ATTEMPTS - 1;
        if (!canRetry) {
          throw error;
        }
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 50 * (attempt + 1));
        });
      }
    }
    throw lastError;
  } finally {
    await session.endSession();
  }
}
