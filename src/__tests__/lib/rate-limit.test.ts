import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Redis to force in-memory fallback for testing
vi.mock("@/lib/redis", () => ({
  redisRateLimit: vi.fn().mockResolvedValue(null),
  cacheIncr: vi.fn().mockResolvedValue(null),
  cacheGet: vi.fn().mockResolvedValue(null),
  cacheSet: vi.fn().mockResolvedValue(null),
  cacheDel: vi.fn().mockResolvedValue(null),
}));

import {
  checkMinuteRateLimit,
  checkAuthRateLimit,
  checkRateLimit,
  isUserBlocked,
  isUserBlockedSync,
} from "@/lib/rate-limit";

describe("rate-limit (in-memory fallback)", () => {
  // Use unique user IDs per test to avoid cross-contamination
  let testId = 0;
  const uid = () => `test-user-${++testId}-${Date.now()}`;

  describe("checkMinuteRateLimit", () => {
    it("allows requests under limit", async () => {
      const id = uid();
      const result = await checkMinuteRateLimit(id, 10);
      expect(result).toBe(true);
    });

    it("allows requests up to the limit", async () => {
      const id = uid();
      for (let i = 0; i < 5; i++) {
        expect(await checkMinuteRateLimit(id, 5)).toBe(i < 5);
      }
    });

    it("rejects requests over the limit", async () => {
      const id = uid();
      // Fill up to limit
      for (let i = 0; i < 3; i++) {
        await checkMinuteRateLimit(id, 3);
      }
      // Next one should be rejected
      expect(await checkMinuteRateLimit(id, 3)).toBe(false);
    });

    it("unlimited when maxPerMinute <= 0", async () => {
      const id = uid();
      expect(await checkMinuteRateLimit(id, 0)).toBe(true);
      expect(await checkMinuteRateLimit(id, -1)).toBe(true);
    });
  });

  describe("checkAuthRateLimit", () => {
    it("allows auth requests under limit", async () => {
      const ip = `192.168.1.${++testId}`;
      const result = await checkAuthRateLimit(ip);
      expect(result.allowed).toBe(true);
    });

    it("blocks IP after exceeding limit", async () => {
      const ip = `10.0.0.${++testId}`;
      // Default AUTH_MAX_PER_MINUTE is 5
      for (let i = 0; i < 5; i++) {
        await checkAuthRateLimit(ip);
      }
      const result = await checkAuthRateLimit(ip);
      expect(result.allowed).toBe(false);
      expect(result.retryAfterSeconds).toBeGreaterThan(0);
    });
  });

  describe("checkRateLimit (generic)", () => {
    it("allows under limit", async () => {
      const key = `generic-${uid()}`;
      expect(await checkRateLimit(key, 5, 60000)).toBe(true);
    });

    it("rejects over limit", async () => {
      const key = `generic-${uid()}`;
      for (let i = 0; i < 3; i++) {
        await checkRateLimit(key, 3, 60000);
      }
      expect(await checkRateLimit(key, 3, 60000)).toBe(false);
    });
  });

  describe("isUserBlocked", () => {
    it("returns not blocked for new user", async () => {
      const result = await isUserBlocked(uid());
      expect(result.blocked).toBe(false);
    });
  });

  describe("isUserBlockedSync", () => {
    it("returns not blocked for new user", () => {
      const result = isUserBlockedSync(uid());
      expect(result.blocked).toBe(false);
    });
  });
});
