import { describe, it, expect } from "vitest";

/**
 * Tests for the min(plan, model) token hierarchy logic.
 * Pure functions — no mocks needed.
 */

function effectiveMaxTokens(planTokensPerMessage: number, modelMaxTokens: number | null): number {
  return Math.min(planTokensPerMessage, modelMaxTokens ?? Infinity);
}

function effectiveContextWindow(planContextWindowSize: number, modelContextWindow: number | null): number {
  return Math.min(planContextWindowSize, modelContextWindow ?? Infinity);
}

describe("Token hierarchy: min(plan, model)", () => {
  describe("effectiveMaxTokens", () => {
    it("uses model limit when model < plan", () => {
      expect(effectiveMaxTokens(16000, 4096)).toBe(4096);
    });

    it("uses plan limit when plan < model", () => {
      expect(effectiveMaxTokens(4096, 16000)).toBe(4096);
    });

    it("falls back to plan when model is null", () => {
      expect(effectiveMaxTokens(8192, null)).toBe(8192);
    });

    it("handles equal values", () => {
      expect(effectiveMaxTokens(4096, 4096)).toBe(4096);
    });

    it("handles very large plan values gracefully", () => {
      expect(effectiveMaxTokens(1_000_000, 8192)).toBe(8192);
    });
  });

  describe("effectiveContextWindow", () => {
    it("uses model context window when model < plan", () => {
      expect(effectiveContextWindow(128000, 32000)).toBe(32000);
    });

    it("uses plan context window when plan < model", () => {
      expect(effectiveContextWindow(32000, 128000)).toBe(32000);
    });

    it("falls back to plan when model is null", () => {
      expect(effectiveContextWindow(64000, null)).toBe(64000);
    });

    it("handles equal values", () => {
      expect(effectiveContextWindow(128000, 128000)).toBe(128000);
    });
  });
});
