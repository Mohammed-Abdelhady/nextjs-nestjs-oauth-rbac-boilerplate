import { AsyncLocalStorage } from 'node:async_hooks';

/** Per-request values code below the controller cannot take as arguments. */
interface RequestContext {
  requestId: string;
}

const requestContext = new AsyncLocalStorage<RequestContext>();

/** Run the rest of a request inside a context carrying its correlation id. */
export function runWithRequestContext<T>(
  requestId: string,
  callback: () => T,
): T {
  return requestContext.run({ requestId }, callback);
}

/** Correlation id of the request being handled, when one is on the stack. */
export function currentRequestId(): string | undefined {
  return requestContext.getStore()?.requestId;
}
