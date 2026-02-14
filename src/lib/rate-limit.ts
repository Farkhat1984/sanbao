const requestTimestamps = new Map<string, number[]>();

// ─── Abuse tracking: auto-block after repeated rate limit violations ───
const violationCounts = new Map<string, { count: number; lastViolation: number }>();
const userBlocklist = new Map<string, number>(); // userId -> unblock timestamp
const VIOLATION_THRESHOLD = 10; // violations before auto-block
const VIOLATION_WINDOW_MS = 5 * 60_000; // 5-minute window
const USER_BLOCK_DURATION_MS = 30 * 60_000; // 30-minute block

function trackViolation(key: string): boolean {
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
    return true; // blocked
  }

  return false;
}

/** Check if a user is auto-blocked due to abuse. */
export function isUserBlocked(userId: string): { blocked: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const blockedUntil = userBlocklist.get(userId);
  if (blockedUntil && now < blockedUntil) {
    return { blocked: true, retryAfterSeconds: Math.ceil((blockedUntil - now) / 1000) };
  }
  if (blockedUntil) userBlocklist.delete(userId);
  return { blocked: false };
}

export function checkMinuteRateLimit(
  userId: string,
  maxPerMinute: number
): boolean {
  if (maxPerMinute <= 0) return true;

  // Check auto-block first
  if (isUserBlocked(userId).blocked) return false;

  const now = Date.now();
  const windowMs = 60_000;
  const timestamps = requestTimestamps.get(userId) ?? [];
  const recent = timestamps.filter((t) => now - t < windowMs);

  if (recent.length >= maxPerMinute) {
    // Track violation for auto-block
    trackViolation(userId);
    return false;
  }

  recent.push(now);
  requestTimestamps.set(userId, recent);
  return true;
}

// ─── IP-based rate limiting for auth routes (brute force protection) ───

const ipTimestamps = new Map<string, number[]>();
const ipBlocklist = new Map<string, number>(); // IP -> unblock timestamp

// 5 login attempts per minute, block for 15 min after exceeding
const AUTH_MAX_PER_MINUTE = 5;
const AUTH_BLOCK_DURATION_MS = 15 * 60_000;

export function checkAuthRateLimit(ip: string): {
  allowed: boolean;
  retryAfterSeconds?: number;
} {
  const now = Date.now();

  // Check if IP is blocked
  const blockedUntil = ipBlocklist.get(ip);
  if (blockedUntil && now < blockedUntil) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((blockedUntil - now) / 1000),
    };
  }
  if (blockedUntil) ipBlocklist.delete(ip);

  const windowMs = 60_000;
  const timestamps = ipTimestamps.get(ip) ?? [];
  const recent = timestamps.filter((t) => now - t < windowMs);

  if (recent.length >= AUTH_MAX_PER_MINUTE) {
    // Block IP for 15 minutes
    ipBlocklist.set(ip, now + AUTH_BLOCK_DURATION_MS);
    ipTimestamps.delete(ip);
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil(AUTH_BLOCK_DURATION_MS / 1000),
    };
  }

  recent.push(now);
  ipTimestamps.set(ip, recent);
  return { allowed: true };
}

// ─── Generic rate limiter for any key + window ───

const genericTimestamps = new Map<string, number[]>();

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const timestamps = genericTimestamps.get(key) ?? [];
  const recent = timestamps.filter((t) => now - t < windowMs);

  if (recent.length >= maxRequests) return false;

  recent.push(now);
  genericTimestamps.set(key, recent);
  return true;
}

// Cleanup stale entries every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of requestTimestamps) {
      const recent = timestamps.filter((t) => now - t < 60_000);
      if (recent.length === 0) requestTimestamps.delete(key);
      else requestTimestamps.set(key, recent);
    }
    for (const [key, timestamps] of ipTimestamps) {
      const recent = timestamps.filter((t) => now - t < 60_000);
      if (recent.length === 0) ipTimestamps.delete(key);
      else ipTimestamps.set(key, recent);
    }
    for (const [key, timestamps] of genericTimestamps) {
      const recent = timestamps.filter((t) => now - t < 300_000);
      if (recent.length === 0) genericTimestamps.delete(key);
      else genericTimestamps.set(key, recent);
    }
    // Cleanup expired blocklist entries
    for (const [ip, until] of ipBlocklist) {
      if (now >= until) ipBlocklist.delete(ip);
    }
    for (const [uid, until] of userBlocklist) {
      if (now >= until) userBlocklist.delete(uid);
    }
    for (const [key, v] of violationCounts) {
      if (now - v.lastViolation > VIOLATION_WINDOW_MS) violationCounts.delete(key);
    }
  }, 300_000);
}
