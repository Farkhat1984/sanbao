import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock dependencies (vi.hoisted to avoid TDZ issues) ───

const {
  mockVerifyGoogleIdToken,
  mockMintSessionToken,
  mockCheckAuthRateLimit,
  mockPrisma,
} = vi.hoisted(() => ({
  mockVerifyGoogleIdToken: vi.fn(),
  mockMintSessionToken: vi.fn(),
  mockCheckAuthRateLimit: vi.fn().mockReturnValue({ allowed: true }),
  mockPrisma: {
    account: { findUnique: vi.fn(), create: vi.fn() },
    user: { findUnique: vi.fn(), create: vi.fn() },
    plan: { findFirst: vi.fn() },
    subscription: { create: vi.fn() },
  },
}));

vi.mock("@/lib/mobile-auth", () => ({
  verifyGoogleIdToken: (...args: unknown[]) => mockVerifyGoogleIdToken(...args),
}));
vi.mock("@/lib/mobile-session", () => ({
  mintSessionToken: (...args: unknown[]) => mockMintSessionToken(...args),
}));
vi.mock("@/lib/rate-limit", () => ({
  checkAuthRateLimit: (...args: unknown[]) => mockCheckAuthRateLimit(...args),
}));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { POST } from "@/app/api/auth/mobile/google/route";

function makeRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost:3000/api/auth/mobile/google", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": "5.6.7.8",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/mobile/google", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckAuthRateLimit.mockReturnValue({ allowed: true });
  });

  it("returns 429 when rate limited", async () => {
    mockCheckAuthRateLimit.mockReturnValue({ allowed: false, retryAfterSeconds: 300 });

    const res = await POST(makeRequest({ idToken: "token" }));
    expect(res.status).toBe(429);
  });

  it("returns 400 when idToken is missing", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toContain("idToken is required");
  });

  it("returns 401 when Google token is invalid", async () => {
    mockVerifyGoogleIdToken.mockRejectedValue(new Error("Invalid token"));

    const res = await POST(makeRequest({ idToken: "bad-token" }));
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.error).toContain("Invalid Google ID token");
  });

  it("returns existing user session when account already linked", async () => {
    mockVerifyGoogleIdToken.mockResolvedValue({
      sub: "google-111",
      email: "user@gmail.com",
      name: "Google User",
      picture: "https://lh3.googleusercontent.com/photo.jpg",
    });

    mockPrisma.account.findUnique.mockResolvedValue({
      user: {
        id: "existing-google-user",
        email: "user@gmail.com",
        name: "Google User",
        image: "https://lh3.googleusercontent.com/photo.jpg",
        role: "USER",
        twoFactorEnabled: false,
      },
    });

    mockMintSessionToken.mockResolvedValue({
      token: "google-session-token",
      expiresAt: "2026-03-20T00:00:00.000Z",
    });

    const res = await POST(makeRequest({ idToken: "valid-google-jwt" }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.token).toBe("google-session-token");
    expect(body.user.id).toBe("existing-google-user");
    expect(body.user.image).toBe("https://lh3.googleusercontent.com/photo.jpg");
  });

  it("creates new user when no account or email match", async () => {
    mockVerifyGoogleIdToken.mockResolvedValue({
      sub: "google-new-222",
      email: "brand-new@gmail.com",
      name: "New Googler",
      picture: "https://lh3.googleusercontent.com/new.jpg",
    });

    mockPrisma.account.findUnique.mockResolvedValue(null);
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: "created-google-user",
      email: "brand-new@gmail.com",
      name: "New Googler",
      image: "https://lh3.googleusercontent.com/new.jpg",
      role: "USER",
      twoFactorEnabled: false,
    });
    mockPrisma.plan.findFirst.mockResolvedValue({ id: "free-plan" });
    mockPrisma.subscription.create.mockResolvedValue({});
    mockPrisma.account.create.mockResolvedValue({});

    mockMintSessionToken.mockResolvedValue({
      token: "new-google-token",
      expiresAt: "2026-03-20T00:00:00.000Z",
    });

    const res = await POST(makeRequest({ idToken: "new-user-jwt" }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.user.id).toBe("created-google-user");

    // Verify user creation
    expect(mockPrisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: "brand-new@gmail.com",
        name: "New Googler",
        image: "https://lh3.googleusercontent.com/new.jpg",
      }),
    });

    // Verify Google account link (same provider as web)
    expect(mockPrisma.account.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        provider: "google",
        providerAccountId: "google-new-222",
      }),
    });
  });

  it("links existing user by email without creating new user", async () => {
    mockVerifyGoogleIdToken.mockResolvedValue({
      sub: "google-link-333",
      email: "already@exists.com",
      name: "Link Me",
    });

    mockPrisma.account.findUnique.mockResolvedValue(null);
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "existing-by-email",
      email: "already@exists.com",
      name: "Already Exists",
      image: null,
      role: "USER",
      twoFactorEnabled: true,
    });
    mockPrisma.account.create.mockResolvedValue({});

    mockMintSessionToken.mockResolvedValue({
      token: "link-token",
      expiresAt: "2026-03-20T00:00:00.000Z",
    });

    const res = await POST(makeRequest({ idToken: "link-jwt" }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.user.id).toBe("existing-by-email");

    // Should NOT create new user
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
    // Should link account
    expect(mockPrisma.account.create).toHaveBeenCalled();
  });

  it("returns 400 when Google account has no email", async () => {
    mockVerifyGoogleIdToken.mockResolvedValue({
      sub: "google-no-email-444",
      email: undefined,
    });

    mockPrisma.account.findUnique.mockResolvedValue(null);

    const res = await POST(makeRequest({ idToken: "no-email-jwt" }));
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toContain("no email");
  });
});
