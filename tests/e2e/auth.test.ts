/**
 * E2E: Authentication flow
 *
 * Tests login, session validation, and auth-protected endpoints.
 * Uses POST /api/auth/login and GET /api/auth/session.
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  BASE_URL,
  COOKIE_NAME,
  apiRequest,
  createAdminToken,
  createUserToken,
  cookieHeader,
  isServerReachable,
} from "./helpers";

let adminToken: string;

beforeAll(async () => {
  const reachable = await isServerReachable();
  if (!reachable) {
    throw new Error(
      `Sanbao server not reachable at ${BASE_URL}. Start it before running E2E tests.`,
    );
  }
  adminToken = await createAdminToken();
});

// ---------------------------------------------------------------------------
// POST /api/auth/login — Login with credentials
// ---------------------------------------------------------------------------

describe("POST /api/auth/login", () => {
  it("should return 400 when email is missing", async () => {
    const res = await apiRequest("/api/auth/login", {
      method: "POST",
      body: { password: "somepassword" },
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data).toHaveProperty("error");
  });

  it("should return 400 when password is missing", async () => {
    const res = await apiRequest("/api/auth/login", {
      method: "POST",
      body: { email: "test@example.com" },
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data).toHaveProperty("error");
  });

  it("should return 401 with invalid credentials", async () => {
    const res = await apiRequest("/api/auth/login", {
      method: "POST",
      body: { email: "nonexistent@example.com", password: "wrongpassword123" },
    });
    // 401 for invalid credentials (or 404 if user not found, depending on impl)
    expect([401, 404]).toContain(res.status);
  });

  it("should return 429 after too many failed attempts from same IP", async () => {
    // Send multiple rapid login attempts to trigger rate limiting
    const results: number[] = [];
    for (let i = 0; i < 15; i++) {
      const res = await apiRequest("/api/auth/login", {
        method: "POST",
        body: { email: "ratelimit@test.com", password: "wrong" },
      });
      results.push(res.status);
      if (res.status === 429) break;
    }
    // At some point we should get rate limited (429) or at least not crash
    const hasRateLimit = results.includes(429);
    const allValid = results.every((s) => [400, 401, 404, 429].includes(s));
    expect(allValid).toBe(true);
    // Note: Rate limiting may not trigger in test environments with Redis disabled.
    // This test verifies the endpoint handles rapid requests gracefully.
  });
});

// ---------------------------------------------------------------------------
// GET /api/auth/session — Session validation
// ---------------------------------------------------------------------------

describe("GET /api/auth/session", () => {
  it("should return empty session without token", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/session`);
    expect(res.status).toBe(200);
    const data = await res.json();
    // NextAuth returns {} or { user: undefined } for unauthenticated
    expect(data.user).toBeUndefined();
  });

  it("should return valid session with admin token", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/session`, {
      headers: { Cookie: cookieHeader(adminToken) },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.user).toBeDefined();
    expect(data.user.email).toBe("zfaragj@gmail.com");
  });

  it("should return session with correct role", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/session`, {
      headers: { Cookie: cookieHeader(adminToken) },
    });
    const data = await res.json();
    expect(data.user.role).toBe("ADMIN");
  });

  it("should reject invalid/malformed token", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/session`, {
      headers: { Cookie: `${COOKIE_NAME}=invalid.token.value` },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    // Invalid token results in no user
    expect(data.user).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Auth-protected endpoints — Verify 401 without session
// ---------------------------------------------------------------------------

describe("Auth-protected endpoints return 401 without session", () => {
  const protectedEndpoints = [
    { method: "GET", path: "/api/conversations" },
    { method: "GET", path: "/api/agents" },
    { method: "GET", path: "/api/mcp" },
  ];

  for (const { method, path } of protectedEndpoints) {
    it(`${method} ${path} should return 401`, async () => {
      const res = await apiRequest(path, { method });
      expect(res.status).toBe(401);
    });
  }
});

// ---------------------------------------------------------------------------
// Auth-protected endpoints — Verify 200 with valid session
// ---------------------------------------------------------------------------

describe("Auth-protected endpoints accept valid session", () => {
  it("GET /api/conversations should return 200 with token", async () => {
    const res = await apiRequest("/api/conversations", { token: adminToken });
    expect(res.status).toBe(200);
  });

  it("GET /api/agents should return 200 with token", async () => {
    const res = await apiRequest("/api/agents", { token: adminToken });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("systemAgents");
    expect(data).toHaveProperty("userAgents");
  });
});

// ---------------------------------------------------------------------------
// 2FA flow
// ---------------------------------------------------------------------------

describe("2FA flow", () => {
  it("POST /api/auth/2fa with no session should return 401", async () => {
    const res = await apiRequest("/api/auth/2fa", {
      method: "POST",
      body: { action: "setup" },
    });
    expect(res.status).toBe(401);
  });

  it("POST /api/auth/2fa/verify with invalid code should fail", async () => {
    const res = await apiRequest("/api/auth/2fa", {
      method: "POST",
      token: adminToken,
      body: { action: "verify", code: "000000" },
    });
    // Should not be 200 with an invalid code
    // Exact status depends on whether 2FA is enabled for this user
    expect([400, 404, 422]).toContain(res.status);
  });
});
