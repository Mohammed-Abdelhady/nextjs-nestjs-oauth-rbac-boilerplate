export class UnknownTransactionOutcomeError extends Error {
  constructor(readonly driverError: unknown) {
    super('The transaction commit outcome is unknown', { cause: driverError });
    this.name = 'UnknownTransactionOutcomeError';
  }
}

export function isUnknownTransactionOutcome(
  error: unknown,
): error is UnknownTransactionOutcomeError {
  return error instanceof UnknownTransactionOutcomeError;
}
