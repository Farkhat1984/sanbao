/**
 * Rate limiting with Redis-first, in-memory fallback.
 * When REDIS_URL is set, all counters are shared across instances.
 * Without Redis, falls back to per-process BoundedMap (dev mode).
 *
 * IMPORTANT: In production, Redis should be a hard requirement for rate limiting.
 * Without Redis, each process maintains its own counters, allowing users to
 * bypass limits by hitting different replicas. The startup check below logs a
 * critical warning when Redis is unavailable in production.
 */

import {
  VIOLATION_THRESHOLD, VIOLATION_WINDOW_MS, USER_BLOCK_DURATION_MS,
  AUTH_MAX_PER_MINUTE as CONST_AUTH_MAX_PER_MINUTE,
  AUTH_BLOCK_DURATION_MS as CONST_AUTH_BLOCK_DURATION_MS,
  CACHE_CLEANUP_INTERVAL_MS,
} from "@/lib/constants";
import { BoundedMap } from "@/lib/bounded-map";
import { redisRateLimit, cacheIncr, cacheGet, cacheSet, cacheDel, isRedisAvailable } from "@/lib/redis";
import { logger } from "@/lib/logger";

// ─── Production Redis check ─────────────────────────────
// In production, rate limiting without Redis is unsafe (per-process counters
// don't protect against distributed abuse across replicas).
// This logs a critical warning at startup — not a crash, to allow graceful degradation.
if (typeof globalThis !== "undefined" && process.env.NODE_ENV === "production") {
  // Delay check to allow Redis connection to establish
  setTimeout(() => {
    if (!isRedisAvailable()) {
      logger.warn(
        "CRITICAL: Redis is NOT available in production. " +
        "Rate limiting is falling back to in-memory per-process counters. " +
        "This is UNSAFE for multi-replica deployments — users can bypass limits. " +
        "Set REDIS_URL environment variable to enable distributed rate limiting.",
        { context: "rate-limit-startup-check" }
      );
    }
  }, 5_000);
}

const RATE_LIMIT_MAX_ENTRIES = 50_000;

/** Warn once per process about in-memory fallback to avoid log spam */
let _loggedFallbackWarning = false;
function warnInMemoryFallback(context: string) {
  if (!_loggedFallbackWarning) {
    logger.warn("Rate limiting falling back to in-memory — Redis unavailable", { context });
    _loggedFallbackWarning = true;
  }
}

// ─── In-memory fallback structures ──────────────────────
const requestTimestamps = new BoundedMap<string, number[]>(RATE_LIMIT_MAX_ENTRIES);
const violationCounts = new BoundedMap<string, { count: number; lastViolation: number }>(RATE_LIMIT_MAX_ENTRIES);
const userBlocklist = new BoundedMap<string, number>(RATE_LIMIT_MAX_ENTRIES);

// ─── Abuse tracking ──────────────────────────────────────

async function trackViolationRedis(key: string): Promise<boolean> {
  const vKey = `rl:viol:${key}`;
  const count = await cacheIncr(vKey, Math.ceil(VIOLATION_WINDOW_MS / 1000));
  if (count === null) {
    warnInMemoryFallback("trackViolation");
    return trackViolationMemory(key);
  }
  if (count >= VIOLATION_THRESHOLD) {
    const blockKey = `rl:block:${key}`;
    await cacheSet(blockKey, "1", Math.ceil(USER_BLOCK_DURATION_MS / 1000));
    await cacheDel(vKey);
    return true;
  }
  return false;
}

function trackViolationMemory(key: string): boolean {
  const now = Date.now();
  const v = violationCounts.get(key);
  if (!v || now - v.lastViolation > VIOLATION_WINDOW_MS) {
    violationCounts.set(key, { count: 1, lastViolation: now });
    return false;
  }
  v.count++;
  v.lastViolation = now;
  if (v.count >= VIOLATION_THRESHOLD) {
    userBlocklist.set(key, now + USER_BLOCK_DURATION_MS);
    violationCounts.delete(key);
    return true;
  }
  return false;
}

/** Check if a user is auto-blocked due to abuse. */
export async function isUserBlocked(userId: string): Promise<{ blocked: boolean; retryAfterSeconds?: number }> {
  // Try Redis first
  const blockKey = `rl:block:${userId}`;
  const blocked = await cacheGet(blockKey);
  if (blocked) {
    return { blocked: true, retryAfterSeconds: Math.ceil(USER_BLOCK_DURATION_MS / 1000) };
  }
  // Fallback to in-memory
  const now = Date.now();
  const blockedUntil = userBlocklist.get(userId);
  if (blockedUntil && now < blockedUntil) {
    return { blocked: true, retryAfterSeconds: Math.ceil((blockedUntil - now) / 1000) };
  }
  if (blockedUntil) userBlocklist.delete(userId);
  return { blocked: false };
}

/** Synchronous in-memory block check (for hot paths that can't await). */
export function isUserBlockedSync(userId: string): { blocked: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const blockedUntil = userBlocklist.get(userId);
  if (blockedUntil && now < blockedUntil) {
    return { blocked: true, retryAfterSeconds: Math.ceil((blockedUntil - now) / 1000) };
  }
  if (blockedUntil) userBlocklist.delete(userId);
  return { blocked: false };
}

export async function checkMinuteRateLimit(
  userId: string,
  maxPerMinute: number
): Promise<boolean> {
  if (maxPerMinute <= 0) return true;

  // Check auto-block
  const block = await isUserBlocked(userId);
  if (block.blocked) return false;

  // Try Redis first
  const rlKey = `rl:min:${userId}`;
  const redisResult = await redisRateLimit(rlKey, maxPerMinute, 60);
  if (redisResult !== null) {
    if (!redisResult) {
      trackViolationRedis(userId).catch(() => {});
    }
    return redisResult;
  }

  // Fallback to in-memory
  warnInMemoryFallback("checkMinuteRateLimit");
  const now = Date.now();
  const windowMs = 60_000;
  const timestamps = requestTimestamps.get(userId) ?? [];
  const recent = timestamps.filter((t) => now - t < windowMs);

  if (recent.length >= maxPerMinute) {
    trackViolationMemory(userId);
    return false;
  }

  recent.push(now);
  requestTimestamps.set(userId, recent);
  return true;
}

// ─── IP-based rate limiting for auth routes ──────────────

const ipTimestamps = new BoundedMap<string, number[]>(RATE_LIMIT_MAX_ENTRIES);
const ipBlocklist = new BoundedMap<string, number>(RATE_LIMIT_MAX_ENTRIES);

const AUTH_MAX_PER_MINUTE = CONST_AUTH_MAX_PER_MINUTE;
const AUTH_BLOCK_DURATION_MS = CONST_AUTH_BLOCK_DURATION_MS;

export function checkAuthRateLimit(ip: string): {
  allowed: boolean;
  retryAfterSeconds?: number;
} {
  const now = Date.now();

  const blockedUntil = ipBlocklist.get(ip);
  if (blockedUntil && now < blockedUntil) {
    return { allowed: false, retryAfterSeconds: Math.ceil((blockedUntil - now) / 1000) };
  }
  if (blockedUntil) ipBlocklist.delete(ip);

  const windowMs = 60_000;
  const timestamps = ipTimestamps.get(ip) ?? [];
  const recent = timestamps.filter((t) => now - t < windowMs);

  if (recent.length >= AUTH_MAX_PER_MINUTE) {
    ipBlocklist.set(ip, now + AUTH_BLOCK_DURATION_MS);
    ipTimestamps.delete(ip);
    return { allowed: false, retryAfterSeconds: Math.ceil(AUTH_BLOCK_DURATION_MS / 1000) };
  }

  recent.push(now);
  ipTimestamps.set(ip, recent);
  return { allowed: true };
}

// ─── Generic rate limiter ────────────────────────────────

const genericTimestamps = new BoundedMap<string, number[]>(RATE_LIMIT_MAX_ENTRIES);

export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<boolean> {
  // Try Redis
  const rlKey = `rl:gen:${key}`;
  const redisResult = await redisRateLimit(rlKey, maxRequests, Math.ceil(windowMs / 1000));
  if (redisResult !== null) return redisResult;

  // Fallback to in-memory
  warnInMemoryFallback("checkRateLimit");
  const now = Date.now();
  const timestamps = genericTimestamps.get(key) ?? [];
  const recent = timestamps.filter((t) => now - t < windowMs);
  if (recent.length >= maxRequests) return false;
  recent.push(now);
  genericTimestamps.set(key, recent);
  return true;
}

// ─── Cleanup (in-memory fallback only) ───────────────────

if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    requestTimestamps.cleanup((timestamps) => {
      const recent = timestamps.filter((t) => now - t < 60_000);
      return recent.length === 0;
    });
    ipTimestamps.cleanup((timestamps) => {
      const recent = timestamps.filter((t) => now - t < 60_000);
      return recent.length === 0;
    });
    genericTimestamps.cleanup((timestamps) => {
      const recent = timestamps.filter((t) => now - t < 300_000);
      return recent.length === 0;
    });
    ipBlocklist.cleanup((until) => now >= until);
    userBlocklist.cleanup((until) => now >= until);
    violationCounts.cleanup((v) => now - v.lastViolation > VIOLATION_WINDOW_MS);
  }, CACHE_CLEANUP_INTERVAL_MS);
}
