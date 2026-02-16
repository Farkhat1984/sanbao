/**
 * Structured JSON logger for production.
 * In development, outputs readable console format.
 * In production (NODE_ENV=production or LOG_FORMAT=json), outputs JSON lines
 * compatible with ELK / Loki / CloudWatch / Datadog.
 *
 * Also exports legacy helpers (logWarn, logError, fireAndForget).
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  msg: string;
  ts: string;
  [key: string]: unknown;
}

const LOG_LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

const isProduction = process.env.NODE_ENV === "production";
const useJson = isProduction || process.env.LOG_FORMAT === "json";
const minLevel = LOG_LEVELS[(process.env.LOG_LEVEL as LogLevel) || (isProduction ? "info" : "debug")];

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= minLevel;
}

function emit(level: LogLevel, msg: string, meta?: Record<string, unknown>) {
  if (!shouldLog(level)) return;

  if (useJson) {
    const entry: LogEntry = { level, msg, ts: new Date().toISOString(), ...meta };
    const line = JSON.stringify(entry);
    if (level === "error") {
      process.stderr?.write?.(line + "\n") ?? console.error(line);
    } else {
      process.stdout?.write?.(line + "\n") ?? console.log(line);
    }
  } else {
    const prefix = `[${level.toUpperCase()}]`;
    const metaStr = meta && Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : "";
    if (level === "error") {
      console.error(`${prefix} ${msg}${metaStr}`);
    } else if (level === "warn") {
      console.warn(`${prefix} ${msg}${metaStr}`);
    } else {
      console.log(`${prefix} ${msg}${metaStr}`);
    }
  }
}

// ─── Primary API ─────────────────────────────────────────

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => emit("debug", msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => emit("info", msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => emit("warn", msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => emit("error", msg, meta),
};

// ─── Legacy helpers (backward-compatible) ────────────────

export function logWarn(context: string, error: unknown, metadata?: Record<string, unknown>): void {
  const msg = error instanceof Error ? error.message : String(error);
  logger.warn(msg, { context, ...metadata });
}

export function logError(context: string, error: unknown, metadata?: Record<string, unknown>): void {
  const msg = error instanceof Error ? error.message : String(error);
  logger.error(msg, { context, stack: error instanceof Error ? error.stack : undefined, ...metadata });
}

/**
 * Fire-and-forget: await a promise in the background, logging any errors.
 */
export function fireAndForget(promise: Promise<unknown>, context: string): void {
  promise.catch((err) => logWarn(context, err));
}
