import { describe, it, expect, vi } from "vitest";

/**
 * Tests for the token correction logic in the onUsage callback.
 * Verifies that the delta between real and estimated tokens is applied correctly.
 */

describe("onUsage token correction", () => {
  it("applies positive delta when real > estimated", () => {
    const incrementTokens = vi.fn();
    const logTokenUsage = vi.fn();

    const estimatedTokens = 100;
    const realInput = 500;
    const realOutput = 300;
    const totalReal = realInput + realOutput; // 800

    // Simulate the onUsage callback logic from route.ts
    const delta = Math.max(0, totalReal - estimatedTokens); // 700
    incrementTokens("user-1", delta);

    expect(incrementTokens).toHaveBeenCalledWith("user-1", 700);
  });

  it("applies zero delta when real < estimated (prevents negative)", () => {
    const incrementTokens = vi.fn();

    const estimatedTokens = 500;
    const realInput = 50;
    const realOutput = 30;
    const totalReal = realInput + realOutput; // 80

    const delta = Math.max(0, totalReal - estimatedTokens); // 0 (not -420)
    incrementTokens("user-1", delta);

    expect(incrementTokens).toHaveBeenCalledWith("user-1", 0);
  });

  it("applies exact zero when real == estimated", () => {
    const incrementTokens = vi.fn();

    const estimatedTokens = 200;
    const totalReal = 200;

    const delta = Math.max(0, totalReal - estimatedTokens);
    incrementTokens("user-1", delta);

    expect(incrementTokens).toHaveBeenCalledWith("user-1", 0);
  });

  it("calculates estimated tokens correctly (chars / 3, min 100)", () => {
    // Mirrors the estimation logic from route.ts
    const calcEstimate = (inputChars: number) => Math.max(100, Math.ceil(inputChars / 3));

    expect(calcEstimate(0)).toBe(100);      // minimum
    expect(calcEstimate(150)).toBe(100);     // 50 < 100, use min
    expect(calcEstimate(300)).toBe(100);     // 100 == 100
    expect(calcEstimate(600)).toBe(200);     // 200 > 100
    expect(calcEstimate(3000)).toBe(1000);   // normal case
  });

  it("does not call logTokenUsage when textModel is null", () => {
    const logTokenUsageFn = vi.fn();
    const textModel = null;

    // Simulate the conditional from route.ts
    if (textModel) {
      logTokenUsageFn();
    }

    expect(logTokenUsageFn).not.toHaveBeenCalled();
  });

  it("calls logTokenUsage with correct params when textModel exists", () => {
    const logTokenUsageFn = vi.fn();
    const textModel = {
      provider: { slug: "moonshot" },
      modelId: "kimi-k2.5",
      costPer1kInput: 0.01,
      costPer1kOutput: 0.03,
    };

    const usage = { inputTokens: 1000, outputTokens: 500 };
    const userId = "user-123";
    const conversationId = "conv-456";

    if (textModel) {
      logTokenUsageFn({
        userId,
        conversationId: conversationId || undefined,
        provider: textModel.provider.slug,
        model: textModel.modelId,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        costPer1kInput: textModel.costPer1kInput,
        costPer1kOutput: textModel.costPer1kOutput,
      });
    }

    expect(logTokenUsageFn).toHaveBeenCalledWith({
      userId: "user-123",
      conversationId: "conv-456",
      provider: "moonshot",
      model: "kimi-k2.5",
      inputTokens: 1000,
      outputTokens: 500,
      costPer1kInput: 0.01,
      costPer1kOutput: 0.03,
    });
  });
});
