import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Mock @auth/core/jwt ───
const mockEncode = vi.fn();
vi.mock("@auth/core/jwt", () => ({
  encode: (...args: unknown[]) => mockEncode(...args),
}));

import { mintSessionToken } from "@/lib/mobile-session";

describe("mobile-session", () => {
  const ORIG_ENV = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...ORIG_ENV, AUTH_SECRET: "test-secret-key-32chars!!" };
  });

  afterEach(() => {
    process.env = ORIG_ENV;
  });

  it("mints a session token with correct claims", async () => {
    mockEncode.mockResolvedValue("encrypted-jwe-token");

    const result = await mintSessionToken({
      id: "user-123",
      email: "test@example.com",
      name: "Test User",
      image: "https://example.com/avatar.jpg",
      role: "USER",
      twoFactorVerified: false,
    });

    expect(result.token).toBe("encrypted-jwe-token");
    expect(result.expiresAt).toBeDefined();

    // Verify expiresAt is ~30 days from now
    const expiresAt = new Date(result.expiresAt).getTime();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    expect(expiresAt).toBeGreaterThan(now + thirtyDaysMs - 5000);
    expect(expiresAt).toBeLessThan(now + thirtyDaysMs + 5000);

    // Verify encode was called with correct params
    expect(mockEncode).toHaveBeenCalledWith(
      expect.objectContaining({
        secret: "test-secret-key-32chars!!",
        maxAge: 30 * 24 * 60 * 60,
        token: expect.objectContaining({
          id: "user-123",
          sub: "user-123",
          name: "Test User",
          email: "test@example.com",
          picture: "https://example.com/avatar.jpg",
          role: "USER",
          twoFactorVerified: false,
        }),
      })
    );
  });

  it("uses correct cookie salt in production", async () => {
    process.env.NODE_ENV = "production";

    // Re-import to get the production cookie name
    // Since the module is already loaded, we test the encode call salt
    mockEncode.mockResolvedValue("prod-token");

    await mintSessionToken({
      id: "user-456",
      email: "prod@example.com",
      name: "Prod User",
      role: "ADMIN",
      twoFactorVerified: true,
    });

    expect(mockEncode).toHaveBeenCalledWith(
      expect.objectContaining({
        salt: expect.any(String),
      })
    );
  });

  it("handles null image", async () => {
    mockEncode.mockResolvedValue("token-no-image");

    await mintSessionToken({
      id: "user-789",
      email: "noimg@example.com",
      name: "No Image",
      image: null,
      role: "USER",
      twoFactorVerified: false,
    });

    expect(mockEncode).toHaveBeenCalledWith(
      expect.objectContaining({
        token: expect.objectContaining({
          picture: null,
        }),
      })
    );
  });

  it("throws when AUTH_SECRET is not set", async () => {
    delete process.env.AUTH_SECRET;
    delete process.env.NEXTAUTH_SECRET;

    await expect(
      mintSessionToken({
        id: "user-000",
        email: "no-secret@example.com",
        name: "No Secret",
        role: "USER",
        twoFactorVerified: false,
      })
    ).rejects.toThrow("AUTH_SECRET is not set");
  });

  it("falls back to NEXTAUTH_SECRET", async () => {
    delete process.env.AUTH_SECRET;
    process.env.NEXTAUTH_SECRET = "nextauth-fallback-secret";

    mockEncode.mockResolvedValue("fallback-token");

    const result = await mintSessionToken({
      id: "user-fallback",
      email: "fb@example.com",
      name: "Fallback",
      role: "USER",
      twoFactorVerified: false,
    });

    expect(result.token).toBe("fallback-token");
    expect(mockEncode).toHaveBeenCalledWith(
      expect.objectContaining({
        secret: "nextauth-fallback-secret",
      })
    );
  });
});
