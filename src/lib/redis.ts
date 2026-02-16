/**
 * Redis client with graceful degradation.
 * If REDIS_URL is not set, all operations silently fall back to no-op.
 * This ensures dev environment works without Redis while production benefits.
 */

import Redis from "ioredis";
import { logger } from "@/lib/logger";

let redis: Redis | null = null;
let isConnected = false;

function getClient(): Redis | null {
  if (redis) return redis;

  const url = process.env.REDIS_URL;
  if (!url) return null;

  redis = new Redis(url, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      if (times > 5) return null; // stop retrying
      return Math.min(times * 200, 2000);
    },
    lazyConnect: false,
    enableReadyCheck: true,
    connectTimeout: 5000,
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

/** Increment a key by 1, with TTL on first set. Returns new value or null. */
export async function cacheIncr(key: string, ttlSeconds: number): Promise<number | null> {
  try {
    const client = getClient();
    if (!client) return null;
    const val = await client.incr(key);
    if (val === 1) {
      await client.expire(key, ttlSeconds);
    }
    return val;
  } catch {
    return null;
  }
}

/** Rate limit check via Redis INCR + EXPIRE. Returns true if allowed. */
export async function redisRateLimit(key: string, max: number, windowSeconds: number): Promise<boolean | null> {
  try {
    const client = getClient();
    if (!client) return null; // null = Redis unavailable, fallback to in-memory
    const count = await client.incr(key);
    if (count === 1) {
      await client.expire(key, windowSeconds);
    }
    return count <= max;
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
