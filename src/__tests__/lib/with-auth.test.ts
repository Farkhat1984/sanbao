import { describe, it, expect, vi, beforeEach } from "vitest";
import { withAuth } from "@/lib/with-auth";
import { NextResponse } from "next/server";

const authMock = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: (...args: unknown[]) => authMock(...args),
}));

describe("withAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when no session", async () => {
    authMock.mockResolvedValue(null);

    const handler = withAuth(async (_req, _ctx, auth) => {
      return NextResponse.json({ userId: auth.userId });
    });

    const req = new Request("http://localhost/api/test");
    const ctx = { params: Promise.resolve({}) };
    const response = await handler(req, ctx);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 401 when session has no user id", async () => {
    authMock.mockResolvedValue({ user: {} });

    const handler = withAuth(async (_req, _ctx, auth) => {
      return NextResponse.json({ userId: auth.userId });
    });

    const req = new Request("http://localhost/api/test");
    const ctx = { params: Promise.resolve({}) };
    const response = await handler(req, ctx);

    expect(response.status).toBe(401);
  });

  it("passes auth context to handler when authenticated", async () => {
    authMock.mockResolvedValue({
      user: { id: "user-123", email: "test@test.com", role: "USER" },
    });

    const handler = withAuth(async (_req, _ctx, auth) => {
      return NextResponse.json({ userId: auth.userId });
    });

    const req = new Request("http://localhost/api/test");
    const ctx = { params: Promise.resolve({}) };
    const response = await handler(req, ctx);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.userId).toBe("user-123");
  });

  it("passes request and context through", async () => {
    authMock.mockResolvedValue({
      user: { id: "user-123" },
    });

    const handler = withAuth(async (req, ctx, _auth) => {
      const { id } = await ctx.params;
      return NextResponse.json({ url: req.url, id });
    });

    const req = new Request("http://localhost/api/items/abc");
    const ctx = { params: Promise.resolve({ id: "abc" }) };
    const response = await handler(req, ctx);

    const body = await response.json();
    expect(body.id).toBe("abc");
    expect(body.url).toContain("/api/items/abc");
  });
});
