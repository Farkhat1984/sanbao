/**
 * Redis client with graceful degradation.
 * If REDIS_URL is not set, all operations silently fall back to no-op.
 * This ensures dev environment works without Redis while production benefits.
 *
 * NOTE: Redis connection parameters (maxRetriesPerRequest, retryStrategy,
 * connectTimeout) are configured at connection time from settings registry
 * defaults. Since getSetting() is async and Redis is created lazily on first
 * use, we use synchronous SETTINGS_MAP lookups for initial values.
 * Changing these settings in the admin panel requires a process restart
 * (all 4 settings have restartRequired: true in settings-registry.ts).
 */

import Redis from "ioredis";
import { logger } from "@/lib/logger";
import { SETTINGS_MAP } from "@/lib/settings-registry";

/** Read a numeric setting default from the registry (synchronous, no DB/Redis). */
function registryDefault(key: string, fallback: number): number {
  const def = SETTINGS_MAP.get(key);
  if (!def) return fallback;
  const n = Number(def.defaultValue);
  return Number.isFinite(n) ? n : fallback;
}

let redis: Redis | null = null;
let isConnected = false;

function getClient(): Redis | null {
  if (redis) return redis;

  const url = process.env.REDIS_URL;
  if (!url) return null;

  const maxRetries = registryDefault("redis_max_retries_per_request", 3);
  const retryMaxAttempts = registryDefault("redis_retry_max_attempts", 5);
  const retryMaxDelay = registryDefault("redis_retry_max_delay_ms", 2000);
  const connectTimeout = registryDefault("redis_connect_timeout_ms", 5000);

  redis = new Redis(url, {
    maxRetriesPerRequest: maxRetries,
    retryStrategy(times) {
      if (times > retryMaxAttempts) return null; // stop retrying
      return Math.min(times * 200, retryMaxDelay);
    },
    lazyConnect: false,
    enableReadyCheck: true,
    connectTimeout,
  });

  redis.on("connect", () => {
    isConnected = true;
    logger.info("Redis connected");
  });
  redis.on("error", (err) => {
    logger.error("Redis connection error", { error: err.message });
    isConnected = false;
  });
  redis.on("close", () => {
    isConnected = false;
  });

  return redis;
}

// ─── Public API ──────────────────────────────────────────

export function getRedis(): Redis | null {
  return getClient();
}

export function isRedisAvailable(): boolean {
  return isConnected && redis !== null;
}

/** Get a value from Redis, returns null if Redis unavailable. */
export async function cacheGet(key: string): Promise<string | null> {
  try {
    const client = getClient();
    if (!client) return null;
    return await client.get(key);
  } catch {
    return null;
  }
}

/** Set a value in Redis with TTL (seconds). */
export async function cacheSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  try {
    const client = getClient();
    if (!client) return;
    await client.set(key, value, "EX", ttlSeconds);
  } catch {
    // silent fallback
  }
}

/** Delete a cache key. */
export async function cacheDel(key: string): Promise<void> {
  try {
    const client = getClient();
    if (!client) return;
    await client.del(key);
  } catch {
    // silent
  }
}

/** Increment a key by 1, with TTL on first set. Returns new value or null.
 *  Uses pipeline to atomically INCR+EXPIRE, preventing orphaned keys if
 *  the process crashes between the two commands. */
export async function cacheIncr(key: string, ttlSeconds: number): Promise<number | null> {
  try {
    const client = getClient();
    if (!client) return null;
    const results = await client.multi().incr(key).expire(key, ttlSeconds).exec();
    if (!results) return null;
    const [incrErr, incrVal] = results[0];
    if (incrErr) return null;
    return incrVal as number;
  } catch {
    return null;
  }
}

/** Rate limit check via Redis INCR + EXPIRE. Returns true if allowed.
 *  Uses pipeline to atomically INCR+EXPIRE. */
export async function redisRateLimit(key: string, max: number, windowSeconds: number): Promise<boolean | null> {
  try {
    const client = getClient();
    if (!client) return null; // null = Redis unavailable, fallback to in-memory
    const results = await client.multi().incr(key).expire(key, windowSeconds).exec();
    if (!results) return null;
    const [incrErr, incrVal] = results[0];
    if (incrErr) return null;
    return (incrVal as number) <= max;
  } catch {
    return null;
  }
}

/** Graceful shutdown. */
export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit().catch(() => {});
    redis = null;
    isConnected = false;
  }
}
