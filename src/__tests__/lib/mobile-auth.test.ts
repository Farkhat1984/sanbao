import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock jose ───
const mockJwtVerify = vi.fn();
vi.mock("jose", () => ({
  createRemoteJWKSet: vi.fn(() => "mock-jwks"),
  jwtVerify: (...args: unknown[]) => mockJwtVerify(...args),
}));

import { verifyAppleToken, verifyGoogleIdToken } from "@/lib/mobile-auth";

describe("mobile-auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Apple Token Verification ───

  describe("verifyAppleToken", () => {
    it("returns payload on valid token", async () => {
      mockJwtVerify.mockResolvedValue({
        payload: {
          sub: "apple-sub-123",
          email: "user@privaterelay.appleid.com",
          email_verified: true,
          is_private_email: true,
        },
      });

      const result = await verifyAppleToken("valid-apple-jwt");

      expect(mockJwtVerify).toHaveBeenCalledWith(
        "valid-apple-jwt",
        "mock-jwks",
        {
          issuer: "https://appleid.apple.com",
          audience: "com.sanbao.sanbaoai",
        }
      );
      expect(result).toEqual({
        sub: "apple-sub-123",
        email: "user@privaterelay.appleid.com",
        email_verified: true,
        is_private_email: true,
      });
    });

    it("passes nonce verification", async () => {
      mockJwtVerify.mockResolvedValue({
        payload: {
          sub: "apple-sub-456",
          email: "test@icloud.com",
          nonce: "correct-nonce",
        },
      });

      const result = await verifyAppleToken("jwt-with-nonce", "correct-nonce");
      expect(result.sub).toBe("apple-sub-456");
    });

    it("rejects nonce mismatch", async () => {
      mockJwtVerify.mockResolvedValue({
        payload: {
          sub: "apple-sub-789",
          nonce: "server-nonce",
        },
      });

      await expect(
        verifyAppleToken("jwt-bad-nonce", "different-nonce")
      ).rejects.toThrow("Apple token nonce mismatch");
    });

    it("throws on invalid token (jose rejects)", async () => {
      mockJwtVerify.mockRejectedValue(new Error("JWSSignatureVerificationFailed"));

      await expect(verifyAppleToken("invalid-jwt")).rejects.toThrow();
    });

    it("handles token without email", async () => {
      mockJwtVerify.mockResolvedValue({
        payload: { sub: "apple-no-email" },
      });

      const result = await verifyAppleToken("no-email-jwt");
      expect(result.sub).toBe("apple-no-email");
      expect(result.email).toBeUndefined();
    });
  });

  // ─── Google Token Verification ───

  describe("verifyGoogleIdToken", () => {
    const ORIG_ENV = process.env;

    beforeEach(() => {
      process.env = { ...ORIG_ENV };
      process.env.AUTH_GOOGLE_ID = "google-web-client-id";
    });

    afterEach(() => {
      process.env = ORIG_ENV;
    });

    it("returns payload on valid token", async () => {
      mockJwtVerify.mockResolvedValue({
        payload: {
          sub: "google-sub-111",
          email: "user@gmail.com",
          email_verified: true,
          name: "Test User",
          picture: "https://lh3.googleusercontent.com/photo.jpg",
        },
      });

      const result = await verifyGoogleIdToken("valid-google-jwt");

      expect(mockJwtVerify).toHaveBeenCalledWith(
        "valid-google-jwt",
        "mock-jwks",
        {
          issuer: ["https://accounts.google.com", "accounts.google.com"],
          audience: ["google-web-client-id"],
        }
      );
      expect(result).toEqual({
        sub: "google-sub-111",
        email: "user@gmail.com",
        email_verified: true,
        name: "Test User",
        picture: "https://lh3.googleusercontent.com/photo.jpg",
      });
    });

    it("includes iOS and Android client IDs when set", async () => {
      process.env.GOOGLE_IOS_CLIENT_ID = "ios-client-id";
      process.env.GOOGLE_ANDROID_CLIENT_ID = "android-client-id";

      mockJwtVerify.mockResolvedValue({
        payload: { sub: "google-sub-222", email: "test@gmail.com" },
      });

      await verifyGoogleIdToken("multi-aud-jwt");

      expect(mockJwtVerify).toHaveBeenCalledWith(
        "multi-aud-jwt",
        "mock-jwks",
        expect.objectContaining({
          audience: ["google-web-client-id", "ios-client-id", "android-client-id"],
        })
      );
    });

    it("throws when no Google client IDs configured", async () => {
      delete process.env.AUTH_GOOGLE_ID;
      delete process.env.GOOGLE_IOS_CLIENT_ID;
      delete process.env.GOOGLE_ANDROID_CLIENT_ID;

      await expect(verifyGoogleIdToken("some-jwt")).rejects.toThrow(
        "No Google client IDs configured"
      );
    });

    it("throws on invalid token (jose rejects)", async () => {
      mockJwtVerify.mockRejectedValue(new Error("JWSSignatureVerificationFailed"));

      await expect(verifyGoogleIdToken("bad-jwt")).rejects.toThrow();
    });
  });
});
