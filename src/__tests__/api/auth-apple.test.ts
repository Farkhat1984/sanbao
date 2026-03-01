import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock dependencies (vi.hoisted to avoid TDZ issues) ───

const {
  mockVerifyAppleToken,
  mockMintSessionToken,
  mockCheckAuthRateLimit,
  mockPrisma,
} = vi.hoisted(() => ({
  mockVerifyAppleToken: vi.fn(),
  mockMintSessionToken: vi.fn(),
  mockCheckAuthRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  mockPrisma: {
    account: { findUnique: vi.fn(), create: vi.fn() },
    user: { findUnique: vi.fn(), create: vi.fn() },
    plan: { findFirst: vi.fn() },
    subscription: { create: vi.fn() },
  },
}));

vi.mock("@/lib/mobile-auth", () => ({
  verifyAppleToken: (...args: unknown[]) => mockVerifyAppleToken(...args),
}));
vi.mock("@/lib/mobile-session", () => ({
  mintSessionToken: (...args: unknown[]) => mockMintSessionToken(...args),
}));
vi.mock("@/lib/rate-limit", () => ({
  checkAuthRateLimit: (...args: unknown[]) => mockCheckAuthRateLimit(...args),
}));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { POST } from "@/app/api/auth/apple/route";

function makeRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost:3000/api/auth/apple", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": "1.2.3.4",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/apple", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckAuthRateLimit.mockReturnValue({ allowed: true });
  });

  it("returns 429 when rate limited", async () => {
    mockCheckAuthRateLimit.mockReturnValue({ allowed: false, retryAfterSeconds: 600 });

    const res = await POST(makeRequest({ identityToken: "token" }));
    expect(res.status).toBe(429);

    const body = await res.json();
    expect(body.error).toContain("Too many attempts");
  });

  it("returns 400 when identityToken is missing", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toContain("identityToken is required");
  });

  it("returns 401 when Apple token is invalid", async () => {
    mockVerifyAppleToken.mockRejectedValue(new Error("Invalid JWT"));

    const res = await POST(makeRequest({ identityToken: "bad-token" }));
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.error).toContain("Invalid Apple identity token");
  });

  it("returns existing user session when account already linked", async () => {
    mockVerifyAppleToken.mockResolvedValue({
      sub: "apple-123",
      email: "user@icloud.com",
    });

    mockPrisma.account.findUnique.mockResolvedValue({
      user: {
        id: "existing-user-id",
        email: "user@icloud.com",
        name: "Existing User",
        image: null,
        role: "USER",
        twoFactorEnabled: false,
      },
    });

    mockMintSessionToken.mockResolvedValue({
      token: "session-token-abc",
      expiresAt: "2026-03-20T00:00:00.000Z",
    });

    const res = await POST(makeRequest({ identityToken: "valid-token" }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.token).toBe("session-token-abc");
    expect(body.user.id).toBe("existing-user-id");
    expect(body.user.email).toBe("user@icloud.com");
    expect(body.expiresAt).toBe("2026-03-20T00:00:00.000Z");
  });

  it("creates new user and account when not found", async () => {
    mockVerifyAppleToken.mockResolvedValue({
      sub: "apple-new-456",
      email: "newuser@icloud.com",
    });

    mockPrisma.account.findUnique.mockResolvedValue(null);
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: "new-user-id",
      email: "newuser@icloud.com",
      name: null,
      image: null,
      role: "USER",
      twoFactorEnabled: false,
    });
    mockPrisma.plan.findFirst.mockResolvedValue({ id: "free-plan-id" });
    mockPrisma.subscription.create.mockResolvedValue({});
    mockPrisma.account.create.mockResolvedValue({});

    mockMintSessionToken.mockResolvedValue({
      token: "new-session-token",
      expiresAt: "2026-03-20T00:00:00.000Z",
    });

    const res = await POST(
      makeRequest({
        identityToken: "valid-new-token",
        fullName: { givenName: "John", familyName: "Doe" },
      })
    );
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.token).toBe("new-session-token");
    expect(body.user.id).toBe("new-user-id");

    // Verify user was created
    expect(mockPrisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: "newuser@icloud.com",
      }),
    });

    // Verify account was linked
    expect(mockPrisma.account.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        provider: "apple",
        providerAccountId: "apple-new-456",
      }),
    });

    // Verify free plan assigned
    expect(mockPrisma.subscription.create).toHaveBeenCalled();
  });

  it("links existing user by email", async () => {
    mockVerifyAppleToken.mockResolvedValue({
      sub: "apple-link-789",
      email: "existing@gmail.com",
    });

    mockPrisma.account.findUnique.mockResolvedValue(null);
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "existing-email-user",
      email: "existing@gmail.com",
      name: "Already Here",
      image: null,
      role: "USER",
      twoFactorEnabled: false,
    });
    mockPrisma.account.create.mockResolvedValue({});

    mockMintSessionToken.mockResolvedValue({
      token: "linked-token",
      expiresAt: "2026-03-20T00:00:00.000Z",
    });

    const res = await POST(makeRequest({ identityToken: "link-token" }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.user.id).toBe("existing-email-user");

    // Should NOT create a new user
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
    // Should create account link
    expect(mockPrisma.account.create).toHaveBeenCalled();
  });

  it("generates placeholder email when Apple provides none", async () => {
    mockVerifyAppleToken.mockResolvedValue({
      sub: "apple-no-email-000",
    });

    mockPrisma.account.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: "no-email-user",
      email: "apple_apple-no-email-000@privaterelay.appleid.com",
      name: null,
      image: null,
      role: "USER",
      twoFactorEnabled: false,
    });
    mockPrisma.plan.findFirst.mockResolvedValue({ id: "free" });
    mockPrisma.subscription.create.mockResolvedValue({});
    mockPrisma.account.create.mockResolvedValue({});

    mockMintSessionToken.mockResolvedValue({
      token: "no-email-token",
      expiresAt: "2026-03-20T00:00:00.000Z",
    });

    const res = await POST(makeRequest({ identityToken: "no-email-jwt" }));
    expect(res.status).toBe(200);

    expect(mockPrisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: "apple_apple-no-email-000@privaterelay.appleid.com",
      }),
    });
  });
});
