import { AppException } from '../../src/common/exceptions/app.exception';

/**
 * Resolve the AppException a call rejects with, and fail the test if it does
 * not reject. Lets a spec assert the code, status and absent details of a
 * refusal without matching on a promise.
 */
export async function rejectionOf(
  promise: Promise<unknown>,
): Promise<AppException> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof AppException) return error;
    throw error;
  }
  throw new Error('Expected the call to reject');
}
