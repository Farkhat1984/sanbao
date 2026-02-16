import { vi } from "vitest";

// ─── Mock next-auth ────────────────────────────────────────
// NextAuth v5 auth() has overloaded return types (Session | NextMiddleware).
// We mock it as a simple async function returning Session | null.
vi.mock("@/lib/auth", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const authMock = vi.fn<() => Promise<any>>().mockResolvedValue({
    user: { id: "test-user-1", email: "test@test.com", role: "USER" },
  });
  return { auth: authMock };
});

// ─── Mock Prisma ───────────────────────────────────────────
vi.mock("@/lib/prisma", () => ({
  prisma: {
    conversation: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
    message: {
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
      count: vi.fn().mockResolvedValue(0),
    },
    agent: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    agentFile: {
      create: vi.fn(),
      delete: vi.fn(),
      findFirst: vi.fn(),
      aggregate: vi.fn().mockResolvedValue({ _sum: { fileSize: 0 } }),
    },
    subscription: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    conversationPlan: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      update: vi.fn(),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    $transaction: vi.fn(async (fn: any) => {
      // Execute the transaction callback passing the same prisma mock as tx
      if (typeof fn === "function") {
        const { prisma: self } = await import("@/lib/prisma");
        return fn(self);
      }
    }),
  },
}));

// ─── Mock usage helper ─────────────────────────────────────
vi.mock("@/lib/usage", () => ({
  getUserPlanAndUsage: vi.fn().mockResolvedValue({
    plan: { maxConversations: 100, maxStorageMb: 500 },
    usage: { messagesCount: 0 },
  }),
  incrementTokens: vi.fn(),
}));

// ─── Mock system-agents ────────────────────────────────────
vi.mock("@/lib/system-agents", () => ({
  resolveAgentId: vi.fn((id: string) => id),
  FEMIDA_ID: "system-femida",
}));

// ─── Mock fs (for agent file routes) ───────────────────────
const writeFile = vi.fn().mockResolvedValue(undefined);
const mkdir = vi.fn().mockResolvedValue(undefined);
const unlink = vi.fn().mockResolvedValue(undefined);
vi.mock("fs/promises", () => ({
  default: { writeFile, mkdir, unlink },
  writeFile,
  mkdir,
  unlink,
}));
