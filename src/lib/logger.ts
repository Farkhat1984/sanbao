/**
 * Structured logging utilities.
 * Replaces silent .catch(() => {}) with logged fire-and-forget.
 */

export function logWarn(context: string, error: unknown, metadata?: Record<string, unknown>): void {
  const msg = error instanceof Error ? error.message : String(error);
  console.warn(`[${context}]`, msg, metadata ?? "");
}

export function logError(context: string, error: unknown, metadata?: Record<string, unknown>): void {
  const msg = error instanceof Error ? error.message : String(error);
  console.error(`[${context}]`, msg, metadata ?? "");
}

/**
 * Fire-and-forget: await a promise in the background, logging any errors.
 * Replaces `.catch(() => {})` with `.catch(err => logWarn(...))`.
 */
export function fireAndForget(promise: Promise<unknown>, context: string): void {
  promise.catch((err) => logWarn(context, err));
}
