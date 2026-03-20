import { describe, it, expect, vi, beforeEach } from "vitest";
import { CircuitBreaker, CircuitBreakerOpenError } from "@/lib/circuit-breaker";

// Mock logger to prevent console output in tests
vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("CircuitBreaker", () => {
  let cb: CircuitBreaker;

  beforeEach(() => {
    cb = new CircuitBreaker({
      name: "test",
      failureThreshold: 3,
      resetTimeoutMs: 1000,
    });
  });

  it("starts in CLOSED state", () => {
    expect(cb.getState()).toBe("CLOSED");
  });

  it("allows execution when CLOSED", async () => {
    const result = await cb.execute(() => Promise.resolve("ok"));
    expect(result).toBe("ok");
    expect(cb.getState()).toBe("CLOSED");
  });

  it("stays CLOSED after failures below threshold", async () => {
    for (let i = 0; i < 2; i++) {
      await cb.execute(() => Promise.reject(new Error("fail"))).catch(() => {});
    }
    expect(cb.getState()).toBe("CLOSED");
  });

  it("transitions to OPEN after reaching failure threshold", async () => {
    for (let i = 0; i < 3; i++) {
      await cb.execute(() => Promise.reject(new Error("fail"))).catch(() => {});
    }
    expect(cb.getState()).toBe("OPEN");
  });

  it("rejects immediately when OPEN", async () => {
    // Trip the breaker
    for (let i = 0; i < 3; i++) {
      await cb.execute(() => Promise.reject(new Error("fail"))).catch(() => {});
    }

    await expect(cb.execute(() => Promise.resolve("ok")))
      .rejects.toThrow(CircuitBreakerOpenError);
  });

  it("transitions to HALF_OPEN after reset timeout", async () => {
    // Use a short timeout breaker
    const shortCb = new CircuitBreaker({
      name: "test-short",
      failureThreshold: 3,
      resetTimeoutMs: 50,
    });

    // Trip the breaker
    for (let i = 0; i < 3; i++) {
      await shortCb.execute(() => Promise.reject(new Error("fail"))).catch(() => {});
    }
    expect(shortCb.getState()).toBe("OPEN");

    // Wait past the reset timeout
    await new Promise((r) => setTimeout(r, 60));

    // Should allow the probe request
    const result = await shortCb.execute(() => Promise.resolve("recovered"));
    expect(result).toBe("recovered");
    expect(shortCb.getState()).toBe("CLOSED");
  });

  it("goes back to OPEN on failure during HALF_OPEN", async () => {
    const shortCb = new CircuitBreaker({
      name: "test-short2",
      failureThreshold: 3,
      resetTimeoutMs: 50,
    });

    for (let i = 0; i < 3; i++) {
      await shortCb.execute(() => Promise.reject(new Error("fail"))).catch(() => {});
    }

    await new Promise((r) => setTimeout(r, 60));

    // Probe fails
    await shortCb.execute(() => Promise.reject(new Error("still failing"))).catch(() => {});
    expect(shortCb.getState()).toBe("OPEN");
  });

  it("resets failure count on successful execution", async () => {
    // 2 failures (below threshold)
    await cb.execute(() => Promise.reject(new Error("fail"))).catch(() => {});
    await cb.execute(() => Promise.reject(new Error("fail"))).catch(() => {});

    // Success resets counter
    await cb.execute(() => Promise.resolve("ok"));

    // 2 more failures should not trip (counter was reset)
    await cb.execute(() => Promise.reject(new Error("fail"))).catch(() => {});
    await cb.execute(() => Promise.reject(new Error("fail"))).catch(() => {});
    expect(cb.getState()).toBe("CLOSED");
  });
});
