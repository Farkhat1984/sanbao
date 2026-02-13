const requestTimestamps = new Map<string, number[]>();

export function checkMinuteRateLimit(
  userId: string,
  maxPerMinute: number
): boolean {
  if (maxPerMinute <= 0) return true;

  const now = Date.now();
  const windowMs = 60_000;
  const timestamps = requestTimestamps.get(userId) ?? [];
  const recent = timestamps.filter((t) => now - t < windowMs);

  if (recent.length >= maxPerMinute) return false;

  recent.push(now);
  requestTimestamps.set(userId, recent);
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
  }, 300_000);
}
