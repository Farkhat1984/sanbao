import { describe, it, expect, vi, beforeEach } from "vitest";

// Use vi.hoisted to create the mock fn before vi.mock is hoisted
const { tokenLogCreate } = vi.hoisted(() => ({
  tokenLogCreate: vi.fn().mockResolvedValue({}),
}));

// Mock Prisma before importing audit module
vi.mock("@/lib/prisma", () => ({
  prisma: {
    tokenLog: { create: tokenLogCreate },
    auditLog: { create: vi.fn() },
    errorLog: { create: vi.fn() },
  },
}));

import { logTokenUsage } from "@/lib/audit";

describe("logTokenUsage", () => {
  beforeEach(() => {
    tokenLogCreate.mockClear();
  });

  it("calculates cost from input and output tokens", async () => {
    await logTokenUsage({
      userId: "user-1",
      provider: "moonshot",
      model: "kimi-k2.5",
      inputTokens: 1000,
      outputTokens: 500,
      costPer1kInput: 0.01,
      costPer1kOutput: 0.03,
    });

    expect(tokenLogCreate).toHaveBeenCalledOnce();
    const data = tokenLogCreate.mock.calls[0][0].data;
    expect(data.userId).toBe("user-1");
    expect(data.provider).toBe("moonshot");
    expect(data.model).toBe("kimi-k2.5");
    expect(data.inputTokens).toBe(1000);
    expect(data.outputTokens).toBe(500);
    // cost = (1000/1000)*0.01 + (500/1000)*0.03 = 0.01 + 0.015 = 0.025
    expect(data.cost).toBeCloseTo(0.025, 6);
  });

  it("defaults cost to 0 when costPer1k not provided", async () => {
    await logTokenUsage({
      userId: "user-2",
      provider: "deepinfra",
      model: "llama-3",
      inputTokens: 2000,
      outputTokens: 1000,
    });

    const data = tokenLogCreate.mock.calls[0][0].data;
    expect(data.cost).toBe(0);
  });

  it("includes conversationId when provided", async () => {
    await logTokenUsage({
      userId: "user-3",
      conversationId: "conv-abc",
      provider: "anthropic",
      model: "claude-4",
      inputTokens: 500,
      outputTokens: 200,
      costPer1kInput: 0.015,
      costPer1kOutput: 0.075,
    });

    const data = tokenLogCreate.mock.calls[0][0].data;
    expect(data.conversationId).toBe("conv-abc");
    // cost = (500/1000)*0.015 + (200/1000)*0.075 = 0.0075 + 0.015 = 0.0225
    expect(data.cost).toBeCloseTo(0.0225, 6);
  });

  it("handles zero tokens", async () => {
    await logTokenUsage({
      userId: "user-4",
      provider: "test",
      model: "test-model",
      inputTokens: 0,
      outputTokens: 0,
      costPer1kInput: 0.01,
      costPer1kOutput: 0.03,
    });

    const data = tokenLogCreate.mock.calls[0][0].data;
    expect(data.cost).toBe(0);
  });
});
