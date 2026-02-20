import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock auth
vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: "admin-1", role: "ADMIN", twoFactorVerified: false },
  }),
}));

// Mock admin
vi.mock("@/lib/admin", () => ({
  requireAdmin: vi.fn().mockResolvedValue({ userId: "admin-1" }),
}));

// Mock prisma — use inline fns only (vi.mock is hoisted, no top-level refs allowed)
vi.mock("@/lib/prisma", () => ({
  prisma: {
    systemSetting: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    promptVersion: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
    },
    $transaction: vi.fn().mockResolvedValue([]),
  },
}));

import { GET, PUT, DELETE } from "@/app/api/admin/prompts/route";
import { PROMPT_REGISTRY, resetPromptCache } from "@/lib/prompts";
import { prisma } from "@/lib/prisma";

function makeRequest(method: string, body?: Record<string, unknown>): Request {
  return new Request("http://localhost/api/admin/prompts", {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("GET /api/admin/prompts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPromptCache();
    (prisma.systemSetting.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  });

  it("returns all 9 prompts", async () => {
    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toHaveLength(9);
    expect(data.map((p: { key: string }) => p.key)).toEqual(Object.keys(PROMPT_REGISTRY));
  });

  it("marks all as default when no overrides exist", async () => {
    const res = await GET();
    const data = await res.json();

    for (const p of data) {
      expect(p.isDefault).toBe(true);
      expect(p.currentValue).toBe(PROMPT_REGISTRY[p.key as keyof typeof PROMPT_REGISTRY]);
    }
  });

  it("marks overridden prompts correctly", async () => {
    (prisma.systemSetting.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { key: "prompt_fix_code", value: "Custom fix prompt", updatedAt: new Date() },
    ]);
    const res = await GET();
    const data = await res.json();

    const fixCode = data.find((p: { key: string }) => p.key === "prompt_fix_code");
    expect(fixCode.isDefault).toBe(false);
    expect(fixCode.currentValue).toBe("Custom fix prompt");

    const planning = data.find((p: { key: string }) => p.key === "prompt_mode_planning");
    expect(planning.isDefault).toBe(true);
  });

  it("each prompt has label and description", async () => {
    const res = await GET();
    const data = await res.json();

    for (const p of data) {
      expect(p.label).toBeTruthy();
      expect(typeof p.label).toBe("string");
      expect(p.description).toBeTruthy();
    }
  });
});

describe("PUT /api/admin/prompts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPromptCache();
    (prisma.promptVersion.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  });

  it("saves a prompt override with versioning", async () => {
    const req = makeRequest("PUT", {
      key: "prompt_fix_code",
      content: "Updated fix prompt content here",
      changelog: "Made it better",
    });

    const res = await PUT(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.version).toBe(1);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("increments version number", async () => {
    (prisma.promptVersion.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ version: 3 });

    const req = makeRequest("PUT", {
      key: "prompt_fix_code",
      content: "Updated content for fix code prompt",
    });

    const res = await PUT(req);
    const data = await res.json();

    expect(data.version).toBe(4);
  });

  it("rejects unknown key", async () => {
    const req = makeRequest("PUT", { key: "nonexistent_key", content: "some content here for test" });
    const res = await PUT(req);
    expect(res.status).toBe(400);
  });

  it("rejects too short content", async () => {
    const req = makeRequest("PUT", { key: "prompt_fix_code", content: "short" });
    const res = await PUT(req);
    expect(res.status).toBe(400);
  });

  it("rejects missing key", async () => {
    const req = makeRequest("PUT", { content: "some content here for testing" });
    const res = await PUT(req);
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/admin/prompts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPromptCache();
    (prisma.promptVersion.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.promptVersion.create as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (prisma.systemSetting.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });
  });

  it("resets prompt to default", async () => {
    const req = makeRequest("DELETE", { key: "prompt_fix_code" });
    const res = await DELETE(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(prisma.systemSetting.deleteMany).toHaveBeenCalled();
  });

  it("records reset in version history", async () => {
    const req = makeRequest("DELETE", { key: "prompt_fix_code" });
    await DELETE(req);

    expect(prisma.promptVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        key: "prompt_fix_code",
        changelog: "Сброс к значению по умолчанию",
      }),
    });
  });

  it("also clears legacy key for prompt_system_global", async () => {
    const req = makeRequest("DELETE", { key: "prompt_system_global" });
    await DELETE(req);

    // Should delete both prompt_system_global and system_prompt_global
    expect(prisma.systemSetting.deleteMany).toHaveBeenCalledTimes(2);
  });

  it("rejects unknown key", async () => {
    const req = makeRequest("DELETE", { key: "bogus_key" });
    const res = await DELETE(req);
    expect(res.status).toBe(400);
  });
});
