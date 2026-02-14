/**
 * Simple in-memory rate limiter for API keys.
 * For production, replace with Redis-backed limiter.
 */

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

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Check rate limit for a given key.
 * @param key - unique identifier (API key, user ID, IP)
 * @param limit - max requests per window
 * @param windowMs - window duration in milliseconds (default 60s)
 */
export function checkRateLimit(
  key: string,
  limit: number = 60,
  windowMs: number = 60_000
): RateLimitResult {
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

/**
 * Apply rate limiting to a request using API key.
 * Returns null if allowed, or a Response if rate-limited.
 */
export function rateLimitByApiKey(
  apiKey: string,
  limit: number = 60
): { allowed: boolean; headers: Record<string, string> } {
  const result = checkRateLimit(`apikey:${apiKey}`, limit, 60_000);
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
  };
  return { allowed: result.allowed, headers };
}
