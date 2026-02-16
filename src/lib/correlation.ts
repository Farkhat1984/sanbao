/**
 * Correlation ID (x-request-id) — traces a request across all layers.
 *
 * - Middleware generates the ID and sets it on request/response headers.
 * - API routes call `runWithCorrelationId()` to propagate via AsyncLocalStorage.
 * - Logger automatically picks up the current ID via `getCorrelationId()`.
 *
 * AsyncLocalStorage is Node.js-only; Edge Runtime (middleware) uses headers directly.
 */

import { AsyncLocalStorage } from "node:async_hooks";

const store = new AsyncLocalStorage<string>();

export const CORRELATION_HEADER = "x-request-id";

/** Generate a new correlation ID. */
export function generateCorrelationId(): string {
  return crypto.randomUUID();
}

/** Get the current correlation ID from AsyncLocalStorage, or null. */
export function getCorrelationId(): string | null {
  return store.getStore() ?? null;
}

/** Run a function with the given correlation ID propagated through AsyncLocalStorage. */
export function runWithCorrelationId<T>(id: string, fn: () => T): T {
  return store.run(id, fn);
}
