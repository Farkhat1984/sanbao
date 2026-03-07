/**
 * Distributed rate limiter — Redis-backed with in-memory fallback.
 *
 * Uses Redis INCR+EXPIRE for distributed rate limiting across 3 app replicas.
 * Falls back to in-memory Map when Redis is unavailable (dev environment).
 */

import { redisRateLimit } from "@/lib/redis";

// ─── In-memory fallback ──────────────────────────────────

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key);
  }
}, 300_000);

function inMemoryCheck(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  entry.count++;
  const allowed = entry.count <= limit;
  return {
    allowed,
    remaining: Math.max(0, limit - entry.count),
    resetAt: entry.resetAt,
  };
}

// ─── Public API ──────────────────────────────────────────

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Check rate limit for a given key.
 * Tries Redis first (distributed), falls back to in-memory.
 *
 * @param key - unique identifier (API key, user ID, IP)
 * @param limit - max requests per window
 * @param windowMs - window duration in milliseconds (default 60s)
 */
export async function checkRateLimitAsync(
  key: string,
  limit: number = 60,
  windowMs: number = 60_000
): Promise<RateLimitResult> {
  const windowSeconds = Math.ceil(windowMs / 1000);
  const redisKey = `rl:${key}`;

  // Try Redis first (shared across replicas)
  const redisResult = await redisRateLimit(redisKey, limit, windowSeconds);
  if (redisResult !== null) {
    const now = Date.now();
    return {
      allowed: redisResult,
      remaining: redisResult ? Math.max(0, limit - 1) : 0,
      resetAt: now + windowMs,
    };
  }

  // Fallback to in-memory (single-instance)
  return inMemoryCheck(key, limit, windowMs);
}

/**
 * Synchronous rate limit check (in-memory only).
 * Use when async is not possible (e.g., middleware edge cases).
 */
export function checkRateLimit(
  key: string,
  limit: number = 60,
  windowMs: number = 60_000
): RateLimitResult {
  return inMemoryCheck(key, limit, windowMs);
}

/**
 * Apply rate limiting by API key.
 * Returns headers for rate limit info.
 */
export async function rateLimitByApiKey(
  apiKey: string,
  limit: number = 60
): Promise<{ allowed: boolean; headers: Record<string, string> }> {
  const result = await checkRateLimitAsync(`apikey:${apiKey}`, limit, 60_000);
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
  };
  return { allowed: result.allowed, headers };
}

/**
 * Apply rate limiting by user ID.
 * Use for per-user limits (e.g., chat API).
 */
export async function rateLimitByUser(
  userId: string,
  limit: number = 30,
  windowMs: number = 60_000
): Promise<RateLimitResult> {
  return checkRateLimitAsync(`user:${userId}`, limit, windowMs);
}
