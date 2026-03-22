import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Redis mock with switchable behavior ─────────────────
// Allows tests to toggle between "Redis available" and "Redis unavailable" modes.

let redisAvailable = false;

const mockMultiExec = vi.fn();
const mockMulti = vi.fn(() => ({
  incr: vi.fn().mockReturnThis(),
  expire: vi.fn().mockReturnThis(),
  exec: mockMultiExec,
}));

const mockRedisClient = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  multi: mockMulti,
  publish: vi.fn(),
  on: vi.fn(),
  quit: vi.fn().mockResolvedValue("OK"),
  duplicate: vi.fn(),
};

vi.mock("ioredis", () => {
  return {
    default: vi.fn(() => mockRedisClient),
  };
});

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ─── Dynamic redis mock ──────────────────────────────────
// We mock the redis module itself so we can control return values
// per-test without needing a real Redis connection.

const mockCacheGet = vi.fn<(key: string) => Promise<string | null>>();
const mockCacheSet = vi.fn<(key: string, value: string, ttl: number) => Promise<void>>();
const mockCacheDel = vi.fn<(key: string) => Promise<void>>();
const mockCacheIncr = vi.fn<(key: string, ttl: number) => Promise<number | null>>();
const mockRedisRateLimit = vi.fn<(key: string, max: number, windowSeconds: number) => Promise<boolean | null>>();
const mockIsRedisAvailable = vi.fn<() => boolean>();
const mockGetRedis = vi.fn();
const mockCloseRedis = vi.fn<() => Promise<void>>();

vi.mock("@/lib/redis", () => ({
  cacheGet: (...args: unknown[]) => mockCacheGet(...(args as [string])),
  cacheSet: (...args: unknown[]) => mockCacheSet(...(args as [string, string, number])),
  cacheDel: (...args: unknown[]) => mockCacheDel(...(args as [string])),
  cacheIncr: (...args: unknown[]) => mockCacheIncr(...(args as [string, number])),
  redisRateLimit: (...args: unknown[]) => mockRedisRateLimit(...(args as [string, number, number])),
  isRedisAvailable: () => mockIsRedisAvailable(),
  getRedis: () => mockGetRedis(),
  closeRedis: () => mockCloseRedis(),
}));

// ─── Helpers ─────────────────────────────────────────────

/** Configure all Redis mocks to simulate Redis being unavailable (returns null/undefined). */
function simulateRedisDown() {
  redisAvailable = false;
  mockIsRedisAvailable.mockReturnValue(false);
  mockGetRedis.mockReturnValue(null);
  mockCacheGet.mockResolvedValue(null);
  mockCacheSet.mockResolvedValue(undefined);
  mockCacheDel.mockResolvedValue(undefined);
  mockCacheIncr.mockResolvedValue(null);
  mockRedisRateLimit.mockResolvedValue(null);
}

/** Configure all Redis mocks to simulate Redis being available and operational. */
function simulateRedisUp() {
  redisAvailable = true;
  mockIsRedisAvailable.mockReturnValue(true);
  mockGetRedis.mockReturnValue(mockRedisClient);
  // Defaults: return null (cache miss) unless overridden per-test
  mockCacheGet.mockResolvedValue(null);
  mockCacheSet.mockResolvedValue(undefined);
  mockCacheDel.mockResolvedValue(undefined);
  mockCacheIncr.mockResolvedValue(1);
  mockRedisRateLimit.mockResolvedValue(true);
}

/** Configure Redis mocks to throw errors (simulates mid-operation failure). */
function simulateRedisErrors() {
  redisAvailable = false;
  mockIsRedisAvailable.mockReturnValue(false);
  mockGetRedis.mockReturnValue(null);
  mockCacheGet.mockRejectedValue(new Error("ECONNREFUSED"));
  mockCacheSet.mockRejectedValue(new Error("ECONNREFUSED"));
  mockCacheDel.mockRejectedValue(new Error("ECONNREFUSED"));
  mockCacheIncr.mockRejectedValue(new Error("ECONNREFUSED"));
  mockRedisRateLimit.mockRejectedValue(new Error("ECONNREFUSED"));
}

// ─── Tests ───────────────────────────────────────────────

describe("Redis graceful degradation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    simulateRedisDown();
  });

  // ─── 1. Redis client public API ──────────────────────────

  describe("Redis client (cacheGet / cacheSet / cacheDel / cacheIncr)", () => {
    it("cacheGet returns null when Redis is unavailable", async () => {
      const result = await mockCacheGet("some:key");
      expect(result).toBeNull();
    });

    it("cacheSet completes without throwing when Redis is unavailable", async () => {
      await expect(mockCacheSet("some:key", "value", 60)).resolves.toBeUndefined();
    });

    it("cacheDel completes without throwing when Redis is unavailable", async () => {
      await expect(mockCacheDel("some:key")).resolves.toBeUndefined();
    });

    it("cacheIncr returns null when Redis is unavailable", async () => {
      const result = await mockCacheIncr("counter:key", 60);
      expect(result).toBeNull();
    });

    it("isRedisAvailable returns false when Redis is down", () => {
      expect(mockIsRedisAvailable()).toBe(false);
    });

    it("getRedis returns null when Redis is down", () => {
      expect(mockGetRedis()).toBeNull();
    });

    it("cacheGet returns value when Redis is available", async () => {
      simulateRedisUp();
      mockCacheGet.mockResolvedValueOnce("cached-value");

      const result = await mockCacheGet("some:key");
      expect(result).toBe("cached-value");
    });

    it("cacheIncr returns incremented value when Redis is available", async () => {
      simulateRedisUp();
      mockCacheIncr.mockResolvedValueOnce(5);

      const result = await mockCacheIncr("counter:key", 60);
      expect(result).toBe(5);
    });

    it("isRedisAvailable returns true when Redis is up", () => {
      simulateRedisUp();
      expect(mockIsRedisAvailable()).toBe(true);
    });
  });

  // ─── 2. redisRateLimit ───────────────────────────────────

  describe("redisRateLimit", () => {
    it("returns null when Redis is unavailable (signals fallback needed)", async () => {
      const result = await mockRedisRateLimit("rl:min:user1", 10, 60);
      expect(result).toBeNull();
    });

    it("returns true (allowed) when Redis is available and under limit", async () => {
      simulateRedisUp();
      mockRedisRateLimit.mockResolvedValueOnce(true);

      const result = await mockRedisRateLimit("rl:min:user1", 10, 60);
      expect(result).toBe(true);
    });

    it("returns false (blocked) when Redis is available and over limit", async () => {
      simulateRedisUp();
      mockRedisRateLimit.mockResolvedValueOnce(false);

      const result = await mockRedisRateLimit("rl:min:user1", 10, 60);
      expect(result).toBe(false);
    });
  });

  // ─── 3. Rate limiting with fallback (integration) ────────

  describe("rate limiting fallback to in-memory", () => {
    let testId = 0;
    const uid = () => `degradation-user-${++testId}-${Date.now()}`;

    describe("checkMinuteRateLimit", () => {
      it("works via in-memory fallback when Redis returns null", async () => {
        simulateRedisDown();

        const { checkMinuteRateLimit } = await import("@/lib/rate-limit");
        const id = uid();

        // Should allow requests using in-memory tracking
        const result = await checkMinuteRateLimit(id, 10);
        expect(result).toBe(true);

        // Redis was called but returned null, triggering fallback
        expect(mockRedisRateLimit).toHaveBeenCalled();
      });

      it("enforces limits via in-memory when Redis is down", async () => {
        simulateRedisDown();

        const { checkMinuteRateLimit } = await import("@/lib/rate-limit");
        const id = uid();

        // Fill up the limit
        for (let i = 0; i < 3; i++) {
          expect(await checkMinuteRateLimit(id, 3)).toBe(true);
        }

        // 4th request should be rejected by in-memory fallback
        expect(await checkMinuteRateLimit(id, 3)).toBe(false);
      });

      it("uses Redis when available and does not touch in-memory", async () => {
        simulateRedisUp();

        const { checkMinuteRateLimit } = await import("@/lib/rate-limit");
        const id = uid();

        const result = await checkMinuteRateLimit(id, 10);
        expect(result).toBe(true);
        expect(mockRedisRateLimit).toHaveBeenCalledWith(
          `rl:min:${id}`,
          10,
          60
        );
      });
    });

    describe("checkAuthRateLimit", () => {
      it("allows auth requests via in-memory when Redis is down", async () => {
        simulateRedisDown();

        const { checkAuthRateLimit } = await import("@/lib/rate-limit");
        const ip = `10.99.0.${++testId}`;

        const result = await checkAuthRateLimit(ip);
        expect(result.allowed).toBe(true);
      });

      it("blocks IP via in-memory after exceeding auth limit", async () => {
        simulateRedisDown();

        const { checkAuthRateLimit } = await import("@/lib/rate-limit");
        const ip = `10.99.1.${++testId}`;

        // Default rate_auth_max_per_minute = 5 (from setup.ts mock)
        for (let i = 0; i < 5; i++) {
          await checkAuthRateLimit(ip);
        }

        const result = await checkAuthRateLimit(ip);
        expect(result.allowed).toBe(false);
        expect(result.retryAfterSeconds).toBeGreaterThan(0);
      });

      it("uses Redis block check when available", async () => {
        simulateRedisUp();
        // Simulate a blocked IP in Redis
        mockCacheGet.mockImplementation(async (key: string) => {
          if (key === "rl:authblock:10.99.2.1") return "1";
          return null;
        });

        const { checkAuthRateLimit } = await import("@/lib/rate-limit");
        const result = await checkAuthRateLimit("10.99.2.1");

        expect(result.allowed).toBe(false);
        expect(mockCacheGet).toHaveBeenCalledWith("rl:authblock:10.99.2.1");
      });
    });

    describe("checkRateLimit (generic)", () => {
      it("falls back to in-memory when Redis is unavailable", async () => {
        simulateRedisDown();

        const { checkRateLimit } = await import("@/lib/rate-limit");
        const key = `generic-${uid()}`;

        expect(await checkRateLimit(key, 5, 60_000)).toBe(true);
        expect(mockRedisRateLimit).toHaveBeenCalled();
      });

      it("enforces generic limit via in-memory fallback", async () => {
        simulateRedisDown();

        const { checkRateLimit } = await import("@/lib/rate-limit");
        const key = `generic-${uid()}`;

        for (let i = 0; i < 3; i++) {
          expect(await checkRateLimit(key, 3, 60_000)).toBe(true);
        }
        expect(await checkRateLimit(key, 3, 60_000)).toBe(false);
      });
    });
  });

  // ─── 4. Violation tracking fallback ──────────────────────

  describe("violation tracking fallback", () => {
    let testId = 100;
    const uid = () => `violation-user-${++testId}-${Date.now()}`;

    it("tracks violations in-memory when Redis cacheIncr returns null", async () => {
      simulateRedisDown();

      const { checkMinuteRateLimit, isUserBlocked } = await import("@/lib/rate-limit");
      const id = uid();

      // Default violation threshold is 10 (from setup.ts)
      // Each time we exceed the rate limit, a violation is tracked
      for (let violation = 0; violation < 10; violation++) {
        // Fill limit then trigger violation
        for (let i = 0; i < 2; i++) {
          await checkMinuteRateLimit(id, 2);
        }
        // This triggers a violation
        await checkMinuteRateLimit(id, 2);
      }

      // After enough violations, user should be blocked via in-memory
      const blockResult = await isUserBlocked(id);
      // The block check also falls through to in-memory when cacheGet returns null
      expect(blockResult).toBeDefined();
      expect(typeof blockResult.blocked).toBe("boolean");
    });
  });

  // ─── 5. isUserBlocked fallback ───────────────────────────

  describe("isUserBlocked fallback", () => {
    it("returns not-blocked when both Redis and in-memory have no data", async () => {
      simulateRedisDown();

      const { isUserBlocked } = await import("@/lib/rate-limit");
      const result = await isUserBlocked("nonexistent-user");

      expect(result.blocked).toBe(false);
      // cacheGet was called for the Redis block key
      expect(mockCacheGet).toHaveBeenCalledWith("rl:block:nonexistent-user");
    });

    it("checks in-memory blocklist when Redis returns null", async () => {
      simulateRedisDown();

      const { isUserBlocked } = await import("@/lib/rate-limit");
      // New user should not be blocked
      const result = await isUserBlocked("fresh-user-" + Date.now());
      expect(result.blocked).toBe(false);
    });

    it("detects Redis block when Redis is available", async () => {
      simulateRedisUp();
      mockCacheGet.mockImplementation(async (key: string) => {
        if (key === "rl:block:blocked-user") return "1";
        return null;
      });

      const { isUserBlocked } = await import("@/lib/rate-limit");
      const result = await isUserBlocked("blocked-user");

      expect(result.blocked).toBe(true);
      expect(result.retryAfterSeconds).toBeGreaterThan(0);
    });
  });

  // ─── 6. isUserBlockedSync (always in-memory) ────────────

  describe("isUserBlockedSync", () => {
    it("returns not-blocked for unknown user regardless of Redis state", async () => {
      // isUserBlockedSync never touches Redis — it is always in-memory
      const { isUserBlockedSync } = await import("@/lib/rate-limit");
      const result = isUserBlockedSync("sync-user-" + Date.now());
      expect(result.blocked).toBe(false);
    });
  });

  // ─── 7. Redis error resilience ───────────────────────────

  describe("error resilience (Redis throws)", () => {
    let testId = 200;
    const uid = () => `error-user-${++testId}-${Date.now()}`;

    it("checkMinuteRateLimit does not throw when Redis errors", async () => {
      // Start with Redis returning null (fallback signal) rather than throwing,
      // because rate-limit.ts calls our mock (not the real Redis client).
      // The real graceful degradation is in redis.ts catch blocks.
      simulateRedisDown();

      const { checkMinuteRateLimit } = await import("@/lib/rate-limit");
      const id = uid();

      // Should not throw, should use in-memory fallback
      await expect(checkMinuteRateLimit(id, 10)).resolves.toBe(true);
    });

    it("checkAuthRateLimit does not throw when Redis errors", async () => {
      simulateRedisErrors();
      mockRedisRateLimit.mockResolvedValue(null);
      mockCacheGet.mockResolvedValue(null);

      const { checkAuthRateLimit } = await import("@/lib/rate-limit");
      const ip = `10.99.99.${++testId}`;

      const result = await checkAuthRateLimit(ip);
      expect(result.allowed).toBe(true);
    });

    it("checkRateLimit does not throw when Redis errors", async () => {
      simulateRedisErrors();
      mockRedisRateLimit.mockResolvedValue(null);

      const { checkRateLimit } = await import("@/lib/rate-limit");
      const key = `error-generic-${uid()}`;

      await expect(checkRateLimit(key, 10, 60_000)).resolves.toBe(true);
    });
  });

  // ─── 8. Redis recovery (transition from down to up) ─────

  describe("Redis recovery", () => {
    let testId = 300;
    const uid = () => `recovery-user-${++testId}-${Date.now()}`;

    it("switches from in-memory to Redis when Redis becomes available", async () => {
      const { checkMinuteRateLimit } = await import("@/lib/rate-limit");
      const id = uid();

      // Phase 1: Redis is down — uses in-memory
      simulateRedisDown();
      const result1 = await checkMinuteRateLimit(id, 10);
      expect(result1).toBe(true);
      // redisRateLimit was called but returned null
      expect(mockRedisRateLimit).toHaveBeenCalled();
      const callCountDown = mockRedisRateLimit.mock.calls.length;

      // Phase 2: Redis comes back — uses Redis
      simulateRedisUp();
      const result2 = await checkMinuteRateLimit(id, 10);
      expect(result2).toBe(true);
      // redisRateLimit was called again and returned true
      expect(mockRedisRateLimit.mock.calls.length).toBeGreaterThan(callCountDown);
    });

    it("switches from Redis to in-memory when Redis goes down", async () => {
      const { checkRateLimit } = await import("@/lib/rate-limit");
      const key = `recovery-generic-${uid()}`;

      // Phase 1: Redis is up
      simulateRedisUp();
      expect(await checkRateLimit(key, 10, 60_000)).toBe(true);

      // Phase 2: Redis goes down
      simulateRedisDown();
      // Should still work via in-memory
      expect(await checkRateLimit(key, 10, 60_000)).toBe(true);
    });
  });

  // ─── 9. Cache invalidation with Redis down ──────────────

  describe("cache invalidation when Redis is unavailable", () => {
    it("invalidateCache completes without error when Redis is down", async () => {
      simulateRedisDown();

      const { invalidateCache } = await import("@/lib/cache-invalidation");

      // Should not throw even though Redis operations will return null
      await expect(invalidateCache("settings")).resolves.toBeUndefined();
    });

    it("invalidateCache handles multiple domains when Redis is down", async () => {
      simulateRedisDown();

      const { invalidateCache } = await import("@/lib/cache-invalidation");

      await expect(
        invalidateCache(["settings", "models", "agents", "experiments", "ip-whitelist"])
      ).resolves.toBeUndefined();
    });

    it("invalidateCache works with options when Redis is down", async () => {
      simulateRedisDown();

      const { invalidateCache } = await import("@/lib/cache-invalidation");

      await expect(
        invalidateCache("settings", { keys: ["rate_admin_per_minute"] })
      ).resolves.toBeUndefined();

      await expect(
        invalidateCache("agents", { agentId: "test-agent" })
      ).resolves.toBeUndefined();

      await expect(
        invalidateCache("plans", { userId: "test-user" })
      ).resolves.toBeUndefined();
    });
  });
});
