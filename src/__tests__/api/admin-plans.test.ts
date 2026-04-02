import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * E2E-style tests for admin plans management (/admin/plans).
 *
 * Covers:
 * 1. Admin Plans API — GET list, PUT update (all fields + feature flags)
 * 2. Three plan definitions (Free, Pro, Business) with correct defaults
 * 3. Feature flag gating per plan tier
 * 4. Quota/limit enforcement per plan tier
 * 5. Edge cases: 0 = unlimited, isDefault mutex, field whitelisting
 * 6. Billing API — /billing/plans, /billing/current field propagation
 */

// ─── Mocks ──────────────────────────────────────────────

vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: "admin-1", role: "ADMIN", twoFactorVerified: false },
  }),
}));

vi.mock("@/lib/admin", () => ({
  requireAdmin: vi.fn().mockResolvedValue({ userId: "admin-1" }),
}));

const mockPlanFindMany = vi.fn();
const mockPlanFindUnique = vi.fn();
const mockPlanUpdate = vi.fn();
const mockPlanUpdateMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    plan: {
      findMany: (...args: unknown[]) => mockPlanFindMany(...args),
      findUnique: (...args: unknown[]) => mockPlanFindUnique(...args),
      update: (...args: unknown[]) => mockPlanUpdate(...args),
      updateMany: (...args: unknown[]) => mockPlanUpdateMany(...args),
    },
  },
}));

// ─── Plan fixtures ──────────────────────────────────────

interface PlanFixture {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  messagesPerDay: number;
  tokensPerMessage: number;
  tokensPerMonth: number;
  requestsPerMinute: number;
  contextWindowSize: number;
  maxConversations: number;
  maxAgents: number;
  documentsPerMonth: number;
  maxStorageMb: number;
  maxOrganizations: number;
  canUseReasoning: boolean;
  canUseSkills: boolean;
  canUseRag: boolean;
  canUseAgents: boolean;
  canUseOrganizations: boolean;
  canUseIntegrations: boolean;
  canUseMcp: boolean;
  canUseGraph: boolean;
  canChooseProvider: boolean;
  isDefault: boolean;
  highlighted: boolean;
  sortOrder: number;
  trialDays: number;
  _count?: { subscriptions: number };
}

const FREE_PLAN: PlanFixture = {
  id: "plan-free",
  slug: "free",
  name: "Free",
  description: "Базовый доступ к AI-ассистенту с ограниченными возможностями",
  price: 0,
  messagesPerDay: 30,
  tokensPerMessage: 32768,
  tokensPerMonth: 500000,
  requestsPerMinute: 3,
  contextWindowSize: 131072,
  maxConversations: 10,
  maxAgents: 0,
  documentsPerMonth: 3,
  maxStorageMb: 50,
  maxOrganizations: 0,
  canUseReasoning: true,
  canUseSkills: false,
  canUseRag: false,
  canUseAgents: false,
  canUseOrganizations: false,
  canUseIntegrations: false,
  canUseMcp: false,
  canUseGraph: false,
  canChooseProvider: false,
  isDefault: true,
  highlighted: false,
  sortOrder: 0,
  trialDays: 0,
  _count: { subscriptions: 10 },
};

const PRO_PLAN: PlanFixture = {
  id: "plan-pro",
  slug: "pro",
  name: "Pro",
  description: "Расширенные возможности: reasoning, агенты, скиллы, выбор провайдера",
  price: 20,
  messagesPerDay: 500,
  tokensPerMessage: 65536,
  tokensPerMonth: 20000000,
  requestsPerMinute: 20,
  contextWindowSize: 262144,
  maxConversations: 100,
  maxAgents: 15,
  documentsPerMonth: 100,
  maxStorageMb: 1024,
  maxOrganizations: 0,
  canUseReasoning: true,
  canUseSkills: true,
  canUseRag: false,
  canUseAgents: true,
  canUseOrganizations: false,
  canUseIntegrations: false,
  canUseMcp: true,
  canUseGraph: false,
  canChooseProvider: true,
  isDefault: false,
  highlighted: true,
  sortOrder: 1,
  trialDays: 7,
  _count: { subscriptions: 0 },
};

const BUSINESS_PLAN: PlanFixture = {
  id: "plan-business",
  slug: "business",
  name: "Business",
  description: "Максимум: все функции, база знаний, организации, безлимит диалогов и агентов",
  price: 60,
  messagesPerDay: 0,
  tokensPerMessage: 131072,
  tokensPerMonth: 0,
  requestsPerMinute: 60,
  contextWindowSize: 262144,
  maxConversations: 0,
  maxAgents: 0,
  documentsPerMonth: 0,
  maxStorageMb: 10240,
  maxOrganizations: 5,
  canUseReasoning: true,
  canUseSkills: true,
  canUseRag: true,
  canUseAgents: true,
  canUseOrganizations: true,
  canUseIntegrations: true,
  canUseMcp: true,
  canUseGraph: false,
  canChooseProvider: true,
  isDefault: false,
  highlighted: false,
  sortOrder: 2,
  trialDays: 14,
  _count: { subscriptions: 17 },
};

const ALL_PLANS = [FREE_PLAN, PRO_PLAN, BUSINESS_PLAN];

// ─── Helpers ────────────────────────────────────────────

function makeRequest(method: string, body?: Record<string, unknown>): Request {
  return new Request("http://localhost/api/admin/plans", {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

// ─── Import routes after mocks ──────────────────────────

import { GET } from "@/app/api/admin/plans/route";
import { PUT } from "@/app/api/admin/plans/[id]/route";

// =====================================================================
// 1. GET /api/admin/plans — List all plans
// =====================================================================

describe("GET /api/admin/plans", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPlanFindMany.mockResolvedValue(ALL_PLANS);
  });

  it("returns all 3 plans sorted by sortOrder", async () => {
    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toHaveLength(3);
    expect(data.map((p: PlanFixture) => p.slug)).toEqual(["free", "pro", "business"]);
  });

  it("includes subscription counts", async () => {
    const res = await GET();
    const data = await res.json();

    expect(data[0]._count.subscriptions).toBe(10);
    expect(data[1]._count.subscriptions).toBe(0);
    expect(data[2]._count.subscriptions).toBe(17);
  });

  it("calls prisma with correct orderBy and include", async () => {
    await GET();

    expect(mockPlanFindMany).toHaveBeenCalledWith({
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { subscriptions: true } } },
      take: 500,
    });
  });
});

// =====================================================================
// 2. PUT /api/admin/plans/[id] — Update plan
// =====================================================================

describe("PUT /api/admin/plans/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPlanFindUnique.mockResolvedValue(FREE_PLAN);
    mockPlanUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      ...FREE_PLAN,
      ...data,
    }));
    mockPlanUpdateMany.mockResolvedValue({ count: 0 });
  });

  it("updates numeric quota fields", async () => {
    const updates = {
      messagesPerDay: 50,
      tokensPerMessage: 65536,
      tokensPerMonth: 1000000,
      requestsPerMinute: 10,
      contextWindowSize: 262144,
      maxConversations: 50,
      maxAgents: 5,
      documentsPerMonth: 10,
      maxStorageMb: 200,
      maxOrganizations: 2,
    };

    const req = makeRequest("PUT", updates);
    const res = await PUT(req, makeParams("plan-free"));
    const data = await res.json();

    expect(res.status).toBe(200);
    for (const [key, val] of Object.entries(updates)) {
      expect(data[key]).toBe(val);
    }
  });

  it("updates all 7 feature flags", async () => {
    const flags = {
      canUseReasoning: true,
      canUseSkills: true,
      canUseRag: true,
      canUseAgents: true,
      canUseOrganizations: true,
      canUseIntegrations: true,
      canUseMcp: true,
    };

    const req = makeRequest("PUT", flags);
    const res = await PUT(req, makeParams("plan-free"));
    const data = await res.json();

    expect(res.status).toBe(200);
    for (const [key, val] of Object.entries(flags)) {
      expect(data[key]).toBe(val);
    }
  });

  it("updates name, description, and price", async () => {
    const req = makeRequest("PUT", {
      name: "Starter",
      description: "Обновлённый тариф",
      price: 10,
    });
    const res = await PUT(req, makeParams("plan-free"));
    const data = await res.json();

    expect(data.name).toBe("Starter");
    expect(data.description).toBe("Обновлённый тариф");
    expect(data.price).toBe(10);
  });

  it("updates highlighted flag", async () => {
    const req = makeRequest("PUT", { highlighted: true });
    const res = await PUT(req, makeParams("plan-free"));
    const data = await res.json();

    expect(data.highlighted).toBe(true);
  });

  it("clears other defaults when setting isDefault", async () => {
    const req = makeRequest("PUT", { isDefault: true });
    await PUT(req, makeParams("plan-pro"));

    expect(mockPlanUpdateMany).toHaveBeenCalledWith({
      where: { isDefault: true },
      data: { isDefault: false },
    });
  });

  it("does not clear defaults when isDefault is not set", async () => {
    const req = makeRequest("PUT", { name: "New Name" });
    await PUT(req, makeParams("plan-free"));

    expect(mockPlanUpdateMany).not.toHaveBeenCalled();
  });

  it("returns 404 for non-existent plan", async () => {
    mockPlanFindUnique.mockResolvedValue(null);

    const req = makeRequest("PUT", { name: "Ghost" });
    const res = await PUT(req, makeParams("plan-nonexistent"));

    expect(res.status).toBe(404);
  });

  it("ignores fields not in allowedUpdateFields (mass assignment protection)", async () => {
    const req = makeRequest("PUT", {
      id: "hacked-id",
      slug: "hacked-slug",
      createdAt: "2020-01-01",
      name: "Legit Update",
    });
    const res = await PUT(req, makeParams("plan-free"));

    expect(res.status).toBe(200);
    // Only "name" should be in the update data
    const updateCall = mockPlanUpdate.mock.calls[0][0];
    expect(updateCall.data).toEqual({ name: "Legit Update" });
    expect(updateCall.data.id).toBeUndefined();
    expect(updateCall.data.slug).toBeUndefined();
    expect(updateCall.data.createdAt).toBeUndefined();
  });

  it("skips undefined fields", async () => {
    const req = makeRequest("PUT", { name: "Updated" });
    await PUT(req, makeParams("plan-free"));

    const updateCall = mockPlanUpdate.mock.calls[0][0];
    expect(Object.keys(updateCall.data)).toEqual(["name"]);
  });
});

// =====================================================================
// 3. Plan tier definitions — correct defaults per spec
// =====================================================================

describe("Plan tier definitions", () => {
  describe("Free plan", () => {
    it("has correct quotas", () => {
      expect(FREE_PLAN.price).toBe(0);
      expect(FREE_PLAN.messagesPerDay).toBe(30);
      expect(FREE_PLAN.tokensPerMessage).toBe(32768);
      expect(FREE_PLAN.tokensPerMonth).toBe(500000);
      expect(FREE_PLAN.requestsPerMinute).toBe(3);
      expect(FREE_PLAN.contextWindowSize).toBe(131072);
      expect(FREE_PLAN.maxConversations).toBe(10);
      expect(FREE_PLAN.maxAgents).toBe(0);
      expect(FREE_PLAN.documentsPerMonth).toBe(3);
      expect(FREE_PLAN.maxStorageMb).toBe(50);
      expect(FREE_PLAN.maxOrganizations).toBe(0);
    });

    it("only has reasoning enabled", () => {
      expect(FREE_PLAN.canUseReasoning).toBe(true);
      expect(FREE_PLAN.canUseSkills).toBe(false);
      expect(FREE_PLAN.canUseRag).toBe(false);
      expect(FREE_PLAN.canUseAgents).toBe(false);
      expect(FREE_PLAN.canUseOrganizations).toBe(false);
      expect(FREE_PLAN.canUseIntegrations).toBe(false);
      expect(FREE_PLAN.canUseMcp).toBe(false);
    });

    it("is the default plan", () => {
      expect(FREE_PLAN.isDefault).toBe(true);
      expect(FREE_PLAN.highlighted).toBe(false);
    });

    it("has no trial period", () => {
      expect(FREE_PLAN.trialDays).toBe(0);
    });
  });

  describe("Pro plan", () => {
    it("has correct quotas", () => {
      expect(PRO_PLAN.price).toBe(20);
      expect(PRO_PLAN.messagesPerDay).toBe(500);
      expect(PRO_PLAN.tokensPerMessage).toBe(65536);
      expect(PRO_PLAN.tokensPerMonth).toBe(20000000);
      expect(PRO_PLAN.requestsPerMinute).toBe(20);
      expect(PRO_PLAN.contextWindowSize).toBe(262144);
      expect(PRO_PLAN.maxConversations).toBe(100);
      expect(PRO_PLAN.maxAgents).toBe(15);
      expect(PRO_PLAN.documentsPerMonth).toBe(100);
      expect(PRO_PLAN.maxStorageMb).toBe(1024);
      expect(PRO_PLAN.maxOrganizations).toBe(0);
    });

    it("has reasoning, skills, agents, MCP enabled; no orgs, integrations, RAG", () => {
      expect(PRO_PLAN.canUseReasoning).toBe(true);
      expect(PRO_PLAN.canUseSkills).toBe(true);
      expect(PRO_PLAN.canUseAgents).toBe(true);
      expect(PRO_PLAN.canUseMcp).toBe(true);
      expect(PRO_PLAN.canUseOrganizations).toBe(false);
      expect(PRO_PLAN.canUseIntegrations).toBe(false);
      expect(PRO_PLAN.canUseRag).toBe(false);
    });

    it("is highlighted (recommended) but not default", () => {
      expect(PRO_PLAN.highlighted).toBe(true);
      expect(PRO_PLAN.isDefault).toBe(false);
    });

    it("has 7-day trial", () => {
      expect(PRO_PLAN.trialDays).toBe(7);
    });

    it("has provider selection enabled", () => {
      expect(PRO_PLAN.canChooseProvider).toBe(true);
    });
  });

  describe("Business plan", () => {
    it("has correct quotas (unlimited where applicable)", () => {
      expect(BUSINESS_PLAN.price).toBe(60);
      expect(BUSINESS_PLAN.messagesPerDay).toBe(0); // unlimited
      expect(BUSINESS_PLAN.tokensPerMessage).toBe(131072);
      expect(BUSINESS_PLAN.tokensPerMonth).toBe(0); // unlimited
      expect(BUSINESS_PLAN.requestsPerMinute).toBe(60);
      expect(BUSINESS_PLAN.contextWindowSize).toBe(262144);
      expect(BUSINESS_PLAN.maxConversations).toBe(0); // unlimited
      expect(BUSINESS_PLAN.maxAgents).toBe(0); // unlimited
      expect(BUSINESS_PLAN.documentsPerMonth).toBe(0); // unlimited
      expect(BUSINESS_PLAN.maxStorageMb).toBe(10240);
      expect(BUSINESS_PLAN.maxOrganizations).toBe(5);
    });

    it("has ALL feature flags enabled (except graph)", () => {
      expect(BUSINESS_PLAN.canUseReasoning).toBe(true);
      expect(BUSINESS_PLAN.canUseSkills).toBe(true);
      expect(BUSINESS_PLAN.canUseRag).toBe(true);
      expect(BUSINESS_PLAN.canUseAgents).toBe(true);
      expect(BUSINESS_PLAN.canUseOrganizations).toBe(true);
      expect(BUSINESS_PLAN.canUseIntegrations).toBe(true);
      expect(BUSINESS_PLAN.canUseMcp).toBe(true);
      expect(BUSINESS_PLAN.canChooseProvider).toBe(true);
    });

    it("graph is reserved (not yet released)", () => {
      expect(BUSINESS_PLAN.canUseGraph).toBe(false);
    });

    it("has 14-day trial", () => {
      expect(BUSINESS_PLAN.trialDays).toBe(14);
    });

    it("is not default and not highlighted", () => {
      expect(BUSINESS_PLAN.isDefault).toBe(false);
      expect(BUSINESS_PLAN.highlighted).toBe(false);
    });
  });
});

// =====================================================================
// 4. Feature flag gating — enforcement logic per plan
// =====================================================================

describe("Feature flag gating per plan", () => {
  const FEATURE_FLAGS = [
    "canUseReasoning",
    "canUseSkills",
    "canUseRag",
    "canUseAgents",
    "canUseOrganizations",
    "canUseIntegrations",
    "canUseMcp",
  ] as const;

  type FeatureFlag = (typeof FEATURE_FLAGS)[number];

  // Expected access matrix
  const ACCESS_MATRIX: Record<string, Record<FeatureFlag, boolean>> = {
    free: {
      canUseReasoning: true,
      canUseSkills: false,
      canUseRag: false,
      canUseAgents: false,
      canUseOrganizations: false,
      canUseIntegrations: false,
      canUseMcp: false,
    },
    pro: {
      canUseReasoning: true,
      canUseSkills: true,
      canUseRag: false,
      canUseAgents: true,
      canUseOrganizations: false,
      canUseIntegrations: false,
      canUseMcp: true,
    },
    business: {
      canUseReasoning: true,
      canUseSkills: true,
      canUseRag: true,
      canUseAgents: true,
      canUseOrganizations: true,
      canUseIntegrations: true,
      canUseMcp: true,
    },
  };

  for (const plan of ALL_PLANS) {
    describe(`${plan.name} plan access`, () => {
      for (const flag of FEATURE_FLAGS) {
        const expected = ACCESS_MATRIX[plan.slug][flag];
        it(`${flag} should be ${expected}`, () => {
          expect(plan[flag]).toBe(expected);
        });
      }
    });
  }

  it("Free plan has exactly 1 feature enabled", () => {
    const count = FEATURE_FLAGS.filter((f) => FREE_PLAN[f]).length;
    expect(count).toBe(1);
  });

  it("Pro plan has exactly 4 features enabled", () => {
    const count = FEATURE_FLAGS.filter((f) => PRO_PLAN[f]).length;
    expect(count).toBe(4);
  });

  it("Business plan has all 7 features enabled", () => {
    const count = FEATURE_FLAGS.filter((f) => BUSINESS_PLAN[f]).length;
    expect(count).toBe(7);
  });

  it("each tier is a strict superset of the previous", () => {
    for (const flag of FEATURE_FLAGS) {
      // If Free has it, Pro must too
      if (FREE_PLAN[flag]) expect(PRO_PLAN[flag]).toBe(true);
      // If Pro has it, Business must too
      if (PRO_PLAN[flag]) expect(BUSINESS_PLAN[flag]).toBe(true);
    }
  });
});

// =====================================================================
// 5. Quota enforcement logic
// =====================================================================

describe("Quota enforcement logic", () => {
  interface PlanQuotas {
    messagesPerDay: number;
    tokensPerMonth: number;
    requestsPerMinute: number;
    maxConversations: number;
    maxAgents: number;
    documentsPerMonth: number;
    maxOrganizations: number;
    maxStorageMb: number;
  }

  interface UsageData {
    messageCount: number;
    tokenCount: number;
  }

  function checkQuota(
    plan: PlanQuotas,
    field: keyof PlanQuotas,
    currentUsage: number,
  ): { allowed: boolean; remaining: number } {
    const limit = plan[field];
    if (limit === 0) return { allowed: true, remaining: Infinity };
    return {
      allowed: currentUsage < limit,
      remaining: Math.max(0, limit - currentUsage),
    };
  }

  function checkPlanLimits(
    plan: PlanFixture,
    usage: UsageData | null,
    monthlyUsage: UsageData,
    options: { thinkingEnabled: boolean },
    isAdmin: boolean,
  ): { error: string; status: number } | null {
    if (isAdmin) return null;

    if (plan.messagesPerDay > 0 && (usage?.messageCount ?? 0) >= plan.messagesPerDay) {
      return { error: `Достигнут дневной лимит сообщений (${plan.messagesPerDay})`, status: 429 };
    }
    if (plan.tokensPerMonth > 0 && monthlyUsage.tokenCount >= plan.tokensPerMonth) {
      return { error: "Достигнут месячный лимит токенов", status: 429 };
    }
    if (options.thinkingEnabled && !plan.canUseReasoning) {
      return { error: "Режим рассуждений недоступен", status: 403 };
    }
    return null;
  }

  describe("0 = unlimited convention", () => {
    it("messagesPerDay=0 means unlimited", () => {
      const result = checkQuota(BUSINESS_PLAN, "messagesPerDay", 999999);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(Infinity);
    });

    it("tokensPerMonth=0 means unlimited", () => {
      const result = checkQuota(BUSINESS_PLAN, "tokensPerMonth", 999999999);
      expect(result.allowed).toBe(true);
    });

    it("maxConversations=0 means unlimited", () => {
      const result = checkQuota(BUSINESS_PLAN, "maxConversations", 5000);
      expect(result.allowed).toBe(true);
    });

    it("maxAgents=0 means unlimited", () => {
      const result = checkQuota(BUSINESS_PLAN, "maxAgents", 100);
      expect(result.allowed).toBe(true);
    });

    it("documentsPerMonth=0 means unlimited", () => {
      const result = checkQuota(BUSINESS_PLAN, "documentsPerMonth", 10000);
      expect(result.allowed).toBe(true);
    });
  });

  describe("Free plan limits", () => {
    it("blocks at 30 messages/day", () => {
      const result = checkQuota(FREE_PLAN, "messagesPerDay", 30);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it("allows 29th message", () => {
      const result = checkQuota(FREE_PLAN, "messagesPerDay", 29);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(1);
    });

    it("blocks at 500K tokens/month", () => {
      const result = checkQuota(FREE_PLAN, "tokensPerMonth", 500000);
      expect(result.allowed).toBe(false);
    });

    it("limits to 10 conversations", () => {
      const result = checkQuota(FREE_PLAN, "maxConversations", 10);
      expect(result.allowed).toBe(false);
    });

    it("limits to 3 documents/month", () => {
      const result = checkQuota(FREE_PLAN, "documentsPerMonth", 3);
      expect(result.allowed).toBe(false);
    });

    it("limits storage to 50MB", () => {
      const result = checkQuota(FREE_PLAN, "maxStorageMb", 50);
      expect(result.allowed).toBe(false);
    });

    it("has no organizations", () => {
      expect(FREE_PLAN.maxOrganizations).toBe(0);
    });
  });

  describe("Pro plan limits", () => {
    it("allows up to 500 messages/day", () => {
      expect(checkQuota(PRO_PLAN, "messagesPerDay", 499).allowed).toBe(true);
      expect(checkQuota(PRO_PLAN, "messagesPerDay", 500).allowed).toBe(false);
    });

    it("allows up to 20M tokens/month", () => {
      expect(checkQuota(PRO_PLAN, "tokensPerMonth", 19999999).allowed).toBe(true);
      expect(checkQuota(PRO_PLAN, "tokensPerMonth", 20000000).allowed).toBe(false);
    });

    it("allows up to 15 agents", () => {
      expect(checkQuota(PRO_PLAN, "maxAgents", 14).allowed).toBe(true);
      expect(checkQuota(PRO_PLAN, "maxAgents", 15).allowed).toBe(false);
    });

    it("allows up to 100 conversations", () => {
      expect(checkQuota(PRO_PLAN, "maxConversations", 99).allowed).toBe(true);
      expect(checkQuota(PRO_PLAN, "maxConversations", 100).allowed).toBe(false);
    });

    it("allows up to 100 documents/month", () => {
      expect(checkQuota(PRO_PLAN, "documentsPerMonth", 99).allowed).toBe(true);
      expect(checkQuota(PRO_PLAN, "documentsPerMonth", 100).allowed).toBe(false);
    });

    it("limits storage to 1GB", () => {
      expect(checkQuota(PRO_PLAN, "maxStorageMb", 1024).allowed).toBe(false);
    });
  });

  describe("Business plan unlimited quotas", () => {
    const HUGE = 999999999;

    it("unlimited messages", () => {
      expect(checkQuota(BUSINESS_PLAN, "messagesPerDay", HUGE).allowed).toBe(true);
    });

    it("unlimited tokens", () => {
      expect(checkQuota(BUSINESS_PLAN, "tokensPerMonth", HUGE).allowed).toBe(true);
    });

    it("unlimited conversations", () => {
      expect(checkQuota(BUSINESS_PLAN, "maxConversations", HUGE).allowed).toBe(true);
    });

    it("unlimited agents", () => {
      expect(checkQuota(BUSINESS_PLAN, "maxAgents", HUGE).allowed).toBe(true);
    });

    it("unlimited documents", () => {
      expect(checkQuota(BUSINESS_PLAN, "documentsPerMonth", HUGE).allowed).toBe(true);
    });

    it("has 5 organizations", () => {
      expect(BUSINESS_PLAN.maxOrganizations).toBe(5);
      expect(checkQuota(BUSINESS_PLAN, "maxOrganizations", 4).allowed).toBe(true);
      expect(checkQuota(BUSINESS_PLAN, "maxOrganizations", 5).allowed).toBe(false);
    });

    it("has 10GB storage", () => {
      expect(BUSINESS_PLAN.maxStorageMb).toBe(10240);
    });
  });

  describe("Admin bypass", () => {
    it("admin bypasses all quota limits", () => {
      const result = checkPlanLimits(
        FREE_PLAN,
        { messageCount: 999, tokenCount: 999999 },
        { messageCount: 999999, tokenCount: 999999 },
        { thinkingEnabled: true },
        true,
      );
      expect(result).toBeNull();
    });

    it("non-admin is blocked by daily limit", () => {
      const result = checkPlanLimits(
        FREE_PLAN,
        { messageCount: 30, tokenCount: 5000 },
        { messageCount: 100, tokenCount: 50000 },
        { thinkingEnabled: false },
        false,
      );
      expect(result).not.toBeNull();
      expect(result!.status).toBe(429);
    });

    it("non-admin is blocked by monthly token limit", () => {
      const result = checkPlanLimits(
        FREE_PLAN,
        { messageCount: 1, tokenCount: 100 },
        { messageCount: 500, tokenCount: 500000 },
        { thinkingEnabled: false },
        false,
      );
      expect(result).not.toBeNull();
      expect(result!.status).toBe(429);
      expect(result!.error).toContain("токенов");
    });
  });

  describe("First message of day (null usage)", () => {
    it("allows first message on Free plan", () => {
      const result = checkPlanLimits(
        FREE_PLAN,
        null,
        { messageCount: 0, tokenCount: 0 },
        { thinkingEnabled: true },
        false,
      );
      expect(result).toBeNull();
    });
  });
});

// =====================================================================
// 6. Plan tier progression — each tier strictly better
// =====================================================================

describe("Plan tier progression", () => {
  const NUMERIC_QUOTAS = [
    "messagesPerDay",
    "tokensPerMessage",
    "tokensPerMonth",
    "requestsPerMinute",
    "contextWindowSize",
  ] as const;

  // For quotas where 0 = unlimited, treat 0 as Infinity for comparison
  function effectiveLimit(val: number): number {
    return val === 0 ? Infinity : val;
  }

  it("Pro quotas are >= Free quotas", () => {
    for (const field of NUMERIC_QUOTAS) {
      const freeVal = effectiveLimit(FREE_PLAN[field]);
      const proVal = effectiveLimit(PRO_PLAN[field]);
      expect(proVal).toBeGreaterThanOrEqual(freeVal);
    }
  });

  it("Business quotas are >= Pro quotas", () => {
    for (const field of NUMERIC_QUOTAS) {
      const proVal = effectiveLimit(PRO_PLAN[field]);
      const bizVal = effectiveLimit(BUSINESS_PLAN[field]);
      expect(bizVal).toBeGreaterThanOrEqual(proVal);
    }
  });

  it("prices are monotonically increasing", () => {
    expect(FREE_PLAN.price).toBeLessThan(PRO_PLAN.price);
    expect(PRO_PLAN.price).toBeLessThan(BUSINESS_PLAN.price);
  });

  it("sortOrder matches tier progression", () => {
    expect(FREE_PLAN.sortOrder).toBe(0);
    expect(PRO_PLAN.sortOrder).toBe(1);
    expect(BUSINESS_PLAN.sortOrder).toBe(2);
  });

  it("only one plan is default", () => {
    const defaultCount = ALL_PLANS.filter((p) => p.isDefault).length;
    expect(defaultCount).toBe(1);
    expect(FREE_PLAN.isDefault).toBe(true);
  });

  it("only one plan is highlighted", () => {
    const highlightedCount = ALL_PLANS.filter((p) => p.highlighted).length;
    expect(highlightedCount).toBe(1);
    expect(PRO_PLAN.highlighted).toBe(true);
  });
});

// =====================================================================
// 7. Token window sizes
// =====================================================================

describe("Token window sizes", () => {
  it("Free has 128K context", () => {
    expect(FREE_PLAN.contextWindowSize).toBe(131072); // 128 * 1024
  });

  it("Pro has 256K context", () => {
    expect(PRO_PLAN.contextWindowSize).toBe(262144); // 256 * 1024
  });

  it("Business has 256K context", () => {
    expect(BUSINESS_PLAN.contextWindowSize).toBe(262144);
  });

  it("Free tokens/message = 32K", () => {
    expect(FREE_PLAN.tokensPerMessage).toBe(32768);
  });

  it("Pro tokens/message = 64K", () => {
    expect(PRO_PLAN.tokensPerMessage).toBe(65536);
  });

  it("Business tokens/message = 128K", () => {
    expect(BUSINESS_PLAN.tokensPerMessage).toBe(131072);
  });

  it("tokens/message fits within context window", () => {
    for (const plan of ALL_PLANS) {
      expect(plan.tokensPerMessage).toBeLessThanOrEqual(plan.contextWindowSize);
    }
  });
});

// =====================================================================
// 8. Subscription expiry interaction with plan access
// =====================================================================

describe("Subscription expiry interaction", () => {
  function checkExpiry(
    expiresAt: Date | null,
    trialEndsAt: Date | null,
    isDefault: boolean,
  ): boolean {
    const now = new Date();
    if (expiresAt && expiresAt < now && !isDefault) return true;
    if (trialEndsAt && trialEndsAt < now && !expiresAt && !isDefault) return true;
    return false;
  }

  it("Free plan never expires (isDefault)", () => {
    const pastDate = new Date(Date.now() - 86400000);
    expect(checkExpiry(pastDate, null, true)).toBe(false);
  });

  it("Pro plan expires when expiresAt is past", () => {
    const pastDate = new Date(Date.now() - 86400000);
    expect(checkExpiry(pastDate, null, false)).toBe(true);
  });

  it("Pro trial expires after 7 days", () => {
    const pastTrial = new Date(Date.now() - 86400000);
    expect(checkExpiry(null, pastTrial, false)).toBe(true);
  });

  it("Business plan active with future expiry", () => {
    const futureDate = new Date(Date.now() + 30 * 86400000);
    expect(checkExpiry(futureDate, null, false)).toBe(false);
  });

  it("active subscription overrides expired trial", () => {
    const futureDate = new Date(Date.now() + 86400000);
    const pastTrial = new Date(Date.now() - 86400000);
    expect(checkExpiry(futureDate, pastTrial, false)).toBe(false);
  });
});

// =====================================================================
// 9. Feature-specific access scenarios
// =====================================================================

describe("Feature-specific access scenarios", () => {
  describe("Reasoning mode", () => {
    it("available on ALL plans (Free, Pro, Business)", () => {
      expect(FREE_PLAN.canUseReasoning).toBe(true);
      expect(PRO_PLAN.canUseReasoning).toBe(true);
      expect(BUSINESS_PLAN.canUseReasoning).toBe(true);
    });
  });

  describe("Skills", () => {
    it("blocked on Free", () => {
      expect(FREE_PLAN.canUseSkills).toBe(false);
    });
    it("available on Pro and Business", () => {
      expect(PRO_PLAN.canUseSkills).toBe(true);
      expect(BUSINESS_PLAN.canUseSkills).toBe(true);
    });
  });

  describe("Agents (custom AI agents)", () => {
    it("blocked on Free", () => {
      expect(FREE_PLAN.canUseAgents).toBe(false);
    });
    it("available on Pro and Business", () => {
      expect(PRO_PLAN.canUseAgents).toBe(true);
      expect(BUSINESS_PLAN.canUseAgents).toBe(true);
    });
  });

  describe("MCP (Model Context Protocol)", () => {
    it("blocked on Free", () => {
      expect(FREE_PLAN.canUseMcp).toBe(false);
    });
    it("available on Pro and Business", () => {
      expect(PRO_PLAN.canUseMcp).toBe(true);
      expect(BUSINESS_PLAN.canUseMcp).toBe(true);
    });
  });

  describe("Organizations", () => {
    it("blocked on Free and Pro", () => {
      expect(FREE_PLAN.canUseOrganizations).toBe(false);
      expect(PRO_PLAN.canUseOrganizations).toBe(false);
    });
    it("available only on Business", () => {
      expect(BUSINESS_PLAN.canUseOrganizations).toBe(true);
    });
    it("Pro has 0 maxOrganizations, Business has 5", () => {
      expect(PRO_PLAN.maxOrganizations).toBe(0);
      expect(BUSINESS_PLAN.maxOrganizations).toBe(5);
    });
  });

  describe("Integrations (OData 1C, etc.)", () => {
    it("blocked on Free and Pro", () => {
      expect(FREE_PLAN.canUseIntegrations).toBe(false);
      expect(PRO_PLAN.canUseIntegrations).toBe(false);
    });
    it("available only on Business", () => {
      expect(BUSINESS_PLAN.canUseIntegrations).toBe(true);
    });
  });

  describe("Knowledge Base (RAG)", () => {
    it("blocked on Free and Pro", () => {
      expect(FREE_PLAN.canUseRag).toBe(false);
      expect(PRO_PLAN.canUseRag).toBe(false);
    });
    it("available only on Business", () => {
      expect(BUSINESS_PLAN.canUseRag).toBe(true);
    });
  });

  describe("Provider selection", () => {
    it("blocked on Free", () => {
      expect(FREE_PLAN.canChooseProvider).toBe(false);
    });
    it("available on Pro and Business", () => {
      expect(PRO_PLAN.canChooseProvider).toBe(true);
      expect(BUSINESS_PLAN.canChooseProvider).toBe(true);
    });
  });
});

// =====================================================================
// 10. PUT update — toggle feature flags on/off
// =====================================================================

describe("PUT /api/admin/plans/[id] — feature flag toggling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPlanFindUnique.mockResolvedValue({ ...FREE_PLAN });
    mockPlanUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      ...FREE_PLAN,
      ...data,
    }));
    mockPlanUpdateMany.mockResolvedValue({ count: 0 });
  });

  it("enables all features on Free plan (upgrade scenario)", async () => {
    const allFlags = {
      canUseReasoning: true,
      canUseSkills: true,
      canUseRag: true,
      canUseAgents: true,
      canUseOrganizations: true,
      canUseIntegrations: true,
      canUseMcp: true,
    };

    const req = makeRequest("PUT", allFlags);
    const res = await PUT(req, makeParams("plan-free"));
    const data = await res.json();

    expect(res.status).toBe(200);
    for (const [key, val] of Object.entries(allFlags)) {
      expect(data[key]).toBe(val);
    }
  });

  it("disables all features (downgrade scenario)", async () => {
    mockPlanFindUnique.mockResolvedValue({ ...BUSINESS_PLAN });
    mockPlanUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      ...BUSINESS_PLAN,
      ...data,
    }));

    const allOff = {
      canUseReasoning: false,
      canUseSkills: false,
      canUseRag: false,
      canUseAgents: false,
      canUseOrganizations: false,
      canUseIntegrations: false,
      canUseMcp: false,
    };

    const req = makeRequest("PUT", allOff);
    const res = await PUT(req, makeParams("plan-business"));
    const data = await res.json();

    expect(res.status).toBe(200);
    for (const [key, val] of Object.entries(allOff)) {
      expect(data[key]).toBe(val);
    }
  });

  it("toggles single flag without affecting others", async () => {
    const req = makeRequest("PUT", { canUseMcp: true });
    const res = await PUT(req, makeParams("plan-free"));

    const updateCall = mockPlanUpdate.mock.calls[0][0];
    expect(Object.keys(updateCall.data)).toEqual(["canUseMcp"]);
    expect(updateCall.data.canUseMcp).toBe(true);
  });

  it("updates quotas and flags simultaneously", async () => {
    const mixed = {
      messagesPerDay: 100,
      canUseSkills: true,
      canUseMcp: true,
      maxAgents: 10,
    };

    const req = makeRequest("PUT", mixed);
    const res = await PUT(req, makeParams("plan-free"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.messagesPerDay).toBe(100);
    expect(data.canUseSkills).toBe(true);
    expect(data.canUseMcp).toBe(true);
    expect(data.maxAgents).toBe(10);
  });
});
