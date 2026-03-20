import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma
const mockFindMany = vi.fn();
const mockCreate = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    webhook: { findMany: (...args: unknown[]) => mockFindMany(...args) },
    webhookLog: { create: (...args: unknown[]) => mockCreate(...args) },
  },
}));

// Mock SSRF check
vi.mock("@/lib/ssrf", () => ({
  isUrlSafeAsync: vi.fn().mockResolvedValue(true),
}));

import { dispatchWebhook } from "@/lib/webhook-dispatcher";

describe("dispatchWebhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockResolvedValue({});
  });

  it("dispatches nothing when no webhooks match", async () => {
    mockFindMany.mockResolvedValue([]);
    await dispatchWebhook("test.event", { foo: "bar" });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("dispatches to all matching webhooks in parallel", async () => {
    const webhooks = [
      { id: "w1", url: "https://example.com/hook1", secret: "s1" },
      { id: "w2", url: "https://example.com/hook2", secret: "s2" },
    ];
    mockFindMany.mockResolvedValue(webhooks);

    // Mock fetch to succeed
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response("OK", { status: 200 })
    );

    await dispatchWebhook("test.event", { foo: "bar" });

    // Both webhooks should be dispatched
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(mockCreate).toHaveBeenCalledTimes(2);

    // Verify both were successful
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          webhookId: "w1",
          success: true,
        }),
      })
    );
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          webhookId: "w2",
          success: true,
        }),
      })
    );

    fetchSpy.mockRestore();
  });

  it("logs SSRF-blocked webhooks", async () => {
    const { isUrlSafeAsync } = await import("@/lib/ssrf");
    (isUrlSafeAsync as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    mockFindMany.mockResolvedValue([
      { id: "w1", url: "http://192.168.1.1/hook", secret: "s1" },
    ]);

    await dispatchWebhook("test.event", {});

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          webhookId: "w1",
          success: false,
          error: expect.stringContaining("internal/reserved"),
        }),
      })
    );
  });

  it("includes correct webhook headers", async () => {
    // Reset SSRF mock (may have been changed by previous test)
    const { isUrlSafeAsync } = await import("@/lib/ssrf");
    (isUrlSafeAsync as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    mockFindMany.mockResolvedValue([
      { id: "w1", url: "https://example.com/hook", secret: "test-secret" },
    ]);

    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response("OK", { status: 200 })
    );

    await dispatchWebhook("user.created", { userId: "123" });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const call = fetchSpy.mock.calls[0];
    const fetchOpts = call[1] as RequestInit;
    const headers = fetchOpts.headers as Record<string, string>;

    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers["X-Webhook-Event"]).toBe("user.created");
    expect(headers["X-Webhook-Signature"]).toMatch(/^sha256=[a-f0-9]+$/);

    fetchSpy.mockRestore();
  });
});
