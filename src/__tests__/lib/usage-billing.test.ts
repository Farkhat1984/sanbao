import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for billing/usage enforcement logic extracted from route.ts
 * These test the pure logic of plan checks without HTTP layer
 */

// Simulate the plan check logic from route.ts
interface PlanLimits {
  messagesPerDay: number;
  tokensPerMonth: number;
  requestsPerMinute: number;
  canUseReasoning: boolean;
  canUseAdvancedTools: boolean;
}

interface UsageData {
  messageCount: number;
  tokenCount: number;
}

interface ChatOptions {
  thinkingEnabled: boolean;
  webSearchEnabled: boolean;
}

function checkPlanLimits(
  plan: PlanLimits,
  usage: UsageData | null,
  monthlyUsage: UsageData,
  options: ChatOptions,
  isAdmin: boolean
): { error: string; status: number } | null {
  if (isAdmin) return null;

  if (plan.messagesPerDay > 0 && (usage?.messageCount ?? 0) >= plan.messagesPerDay) {
    return {
      error: `Достигнут дневной лимит сообщений (${plan.messagesPerDay})`,
      status: 429,
    };
  }

  if (plan.tokensPerMonth > 0 && monthlyUsage.tokenCount >= plan.tokensPerMonth) {
    return { error: "Достигнут месячный лимит токенов", status: 429 };
  }

  if (options.thinkingEnabled && !plan.canUseReasoning) {
    return { error: "Режим рассуждений недоступен", status: 403 };
  }

  if (options.webSearchEnabled && !plan.canUseAdvancedTools) {
    return { error: "Веб-поиск недоступен", status: 403 };
  }

  return null;
}

describe("Plan enforcement logic", () => {
  const freePlan: PlanLimits = {
    messagesPerDay: 20,
    tokensPerMonth: 100000,
    requestsPerMinute: 5,
    canUseReasoning: false,
    canUseAdvancedTools: false,
  };

  const proPlan: PlanLimits = {
    messagesPerDay: 100,
    tokensPerMonth: 1000000,
    requestsPerMinute: 30,
    canUseReasoning: true,
    canUseAdvancedTools: true,
  };

  const unlimitedPlan: PlanLimits = {
    messagesPerDay: 0, // 0 = unlimited
    tokensPerMonth: 0,
    requestsPerMinute: 0,
    canUseReasoning: true,
    canUseAdvancedTools: true,
  };

  describe("Daily message limit", () => {
    it("allows messages under limit", () => {
      const result = checkPlanLimits(
        freePlan,
        { messageCount: 5, tokenCount: 1000 },
        { messageCount: 100, tokenCount: 50000 },
        { thinkingEnabled: false, webSearchEnabled: false },
        false
      );
      expect(result).toBeNull();
    });

    it("blocks at daily limit", () => {
      const result = checkPlanLimits(
        freePlan,
        { messageCount: 20, tokenCount: 5000 },
        { messageCount: 600, tokenCount: 50000 },
        { thinkingEnabled: false, webSearchEnabled: false },
        false
      );
      expect(result).not.toBeNull();
      expect(result!.status).toBe(429);
      expect(result!.error).toContain("20");
    });

    it("blocks over daily limit", () => {
      const result = checkPlanLimits(
        freePlan,
        { messageCount: 25, tokenCount: 5000 },
        { messageCount: 100, tokenCount: 50000 },
        { thinkingEnabled: false, webSearchEnabled: false },
        false
      );
      expect(result).not.toBeNull();
      expect(result!.status).toBe(429);
    });

    it("unlimited when messagesPerDay = 0", () => {
      const result = checkPlanLimits(
        unlimitedPlan,
        { messageCount: 9999, tokenCount: 999999 },
        { messageCount: 999999, tokenCount: 999999 },
        { thinkingEnabled: true, webSearchEnabled: true },
        false
      );
      expect(result).toBeNull();
    });

    it("handles null usage (first message of day)", () => {
      const result = checkPlanLimits(
        freePlan,
        null,
        { messageCount: 0, tokenCount: 0 },
        { thinkingEnabled: false, webSearchEnabled: false },
        false
      );
      expect(result).toBeNull();
    });
  });

  describe("Monthly token limit", () => {
    it("blocks at monthly token limit", () => {
      const result = checkPlanLimits(
        freePlan,
        { messageCount: 1, tokenCount: 100 },
        { messageCount: 500, tokenCount: 100000 },
        { thinkingEnabled: false, webSearchEnabled: false },
        false
      );
      expect(result).not.toBeNull();
      expect(result!.status).toBe(429);
      expect(result!.error).toContain("токенов");
    });
  });

  describe("Feature gating", () => {
    it("blocks reasoning on free plan", () => {
      const result = checkPlanLimits(
        freePlan,
        { messageCount: 1, tokenCount: 100 },
        { messageCount: 10, tokenCount: 5000 },
        { thinkingEnabled: true, webSearchEnabled: false },
        false
      );
      expect(result).not.toBeNull();
      expect(result!.status).toBe(403);
    });

    it("allows reasoning on pro plan", () => {
      const result = checkPlanLimits(
        proPlan,
        { messageCount: 1, tokenCount: 100 },
        { messageCount: 10, tokenCount: 5000 },
        { thinkingEnabled: true, webSearchEnabled: false },
        false
      );
      expect(result).toBeNull();
    });

    it("blocks web search on free plan", () => {
      const result = checkPlanLimits(
        freePlan,
        { messageCount: 1, tokenCount: 100 },
        { messageCount: 10, tokenCount: 5000 },
        { thinkingEnabled: false, webSearchEnabled: true },
        false
      );
      expect(result).not.toBeNull();
      expect(result!.status).toBe(403);
    });

    it("allows web search on pro plan", () => {
      const result = checkPlanLimits(
        proPlan,
        { messageCount: 1, tokenCount: 100 },
        { messageCount: 10, tokenCount: 5000 },
        { thinkingEnabled: false, webSearchEnabled: true },
        false
      );
      expect(result).toBeNull();
    });
  });

  describe("Admin bypass", () => {
    it("admin bypasses all limits", () => {
      const result = checkPlanLimits(
        freePlan,
        { messageCount: 999, tokenCount: 999999 },
        { messageCount: 999999, tokenCount: 999999 },
        { thinkingEnabled: true, webSearchEnabled: true },
        true
      );
      expect(result).toBeNull();
    });
  });

  describe("Subscription expiry logic", () => {
    // Simulates getUserPlanAndUsage expiry check
    function checkExpiry(
      expiresAt: Date | null,
      trialEndsAt: Date | null,
      isDefault: boolean
    ): boolean {
      const now = new Date();
      if (expiresAt && expiresAt < now && !isDefault) return true;
      if (trialEndsAt && trialEndsAt < now && !expiresAt && !isDefault) return true;
      return false;
    }

    it("detects expired subscription", () => {
      const pastDate = new Date(Date.now() - 86400000);
      expect(checkExpiry(pastDate, null, false)).toBe(true);
    });

    it("does not expire active subscription", () => {
      const futureDate = new Date(Date.now() + 86400000);
      expect(checkExpiry(futureDate, null, false)).toBe(false);
    });

    it("detects expired trial", () => {
      const pastDate = new Date(Date.now() - 86400000);
      expect(checkExpiry(null, pastDate, false)).toBe(true);
    });

    it("does not expire default plan", () => {
      const pastDate = new Date(Date.now() - 86400000);
      expect(checkExpiry(pastDate, null, true)).toBe(false);
    });

    it("does not expire trial when subscription exists", () => {
      const futureDate = new Date(Date.now() + 86400000);
      const pastTrial = new Date(Date.now() - 86400000);
      expect(checkExpiry(futureDate, pastTrial, false)).toBe(false);
    });
  });
});
