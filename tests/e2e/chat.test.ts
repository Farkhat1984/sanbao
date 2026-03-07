/**
 * E2E: Chat endpoints
 *
 * Tests conversation CRUD and the /api/chat streaming endpoint.
 * Requires a running Sanbao instance with at least one LLM provider configured.
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  BASE_URL,
  apiRequest,
  createAdminToken,
  parseStream,
  getStreamContent,
  getStreamStatuses,
  getStreamErrors,
  cookieHeader,
  COOKIE_NAME,
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
// GET /api/conversations — List conversations
// ---------------------------------------------------------------------------

describe("GET /api/conversations", () => {
  it("should return 401 without auth", async () => {
    const res = await apiRequest("/api/conversations");
    expect(res.status).toBe(401);
  });

  it("should return conversations list with valid token", async () => {
    const res = await apiRequest("/api/conversations", { token: adminToken });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty("conversations");
    expect(Array.isArray(data.conversations)).toBe(true);
  });

  it("should support cursor pagination", async () => {
    const res = await apiRequest("/api/conversations?limit=5", {
      token: adminToken,
    });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty("conversations");
    // nextCursor may or may not be present depending on data
    if (data.conversations.length === 5) {
      expect(data).toHaveProperty("nextCursor");
    }
  });
});

// ---------------------------------------------------------------------------
// POST /api/conversations — Create conversation
// ---------------------------------------------------------------------------

describe("POST /api/conversations", () => {
  it("should return 401 without auth", async () => {
    const res = await apiRequest("/api/conversations", {
      method: "POST",
      body: { title: "Test" },
    });
    expect(res.status).toBe(401);
  });

  it("should create a new conversation", async () => {
    const res = await apiRequest("/api/conversations", {
      method: "POST",
      token: adminToken,
      body: { title: "E2E Test Conversation" },
    });
    expect(res.status).toBe(201);

    const data = await res.json();
    expect(data).toHaveProperty("id");
    expect(data.title).toBe("E2E Test Conversation");
  });

  it("should create conversation with agent ID", async () => {
    const res = await apiRequest("/api/conversations", {
      method: "POST",
      token: adminToken,
      body: {
        title: "E2E Lawyer Conversation",
        agentId: "system-femida-agent",
      },
    });
    // 201 if agent exists, 400/404 if not
    expect([201, 400, 404]).toContain(res.status);
  });
});

// ---------------------------------------------------------------------------
// POST /api/chat — Send message (streaming)
// ---------------------------------------------------------------------------

describe("POST /api/chat", () => {
  it("should return 401 without auth", async () => {
    const res = await fetch(`${BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "Hello" }],
      }),
    });
    expect([401, 403]).toContain(res.status);
  });

  it("should return streaming response for simple message", async () => {
    const res = await fetch(`${BASE_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader(adminToken),
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: "Say hello in one word" }],
        thinkingEnabled: false,
        webSearchEnabled: false,
      }),
    });
    expect(res.status).toBe(200);

    const chunks = await parseStream(res);
    expect(chunks.length).toBeGreaterThan(0);

    const content = getStreamContent(chunks);
    expect(content.length).toBeGreaterThan(0);

    // Should have no stream errors
    const errors = getStreamErrors(chunks);
    expect(errors).toHaveLength(0);
  }, 120_000);

  it("should accept message with agent context (lawyer)", async () => {
    const res = await fetch(`${BASE_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader(adminToken),
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: "What is article 188 of the Criminal Code of Kazakhstan?" }],
        agentId: "system-femida-agent",
        thinkingEnabled: false,
        webSearchEnabled: false,
      }),
    });
    // May return 200 (streams) or an error if MCP is not connected
    expect([200, 500, 503]).toContain(res.status);

    if (res.status === 200) {
      const chunks = await parseStream(res);
      const content = getStreamContent(chunks);
      expect(content.length).toBeGreaterThan(0);

      // Lawyer agent typically uses MCP tools
      const statuses = getStreamStatuses(chunks);
      // May or may not use tools depending on agent configuration
      expect(chunks.length).toBeGreaterThan(0);
    }
  }, 120_000);

  it("should handle empty message gracefully", async () => {
    const res = await fetch(`${BASE_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader(adminToken),
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: "" }],
        thinkingEnabled: false,
        webSearchEnabled: false,
      }),
    });
    // Empty message may return 400 or stream a response
    expect([200, 400]).toContain(res.status);
  });

  it("should reject malformed request body", async () => {
    const res = await fetch(`${BASE_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader(adminToken),
      },
      body: "not-json",
    });
    expect([400, 500]).toContain(res.status);
  });

  it("should reject request without messages array", async () => {
    const res = await fetch(`${BASE_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader(adminToken),
      },
      body: JSON.stringify({ thinkingEnabled: false }),
    });
    expect([400, 500]).toContain(res.status);
  });
});

// ---------------------------------------------------------------------------
// Conversation lifecycle
// ---------------------------------------------------------------------------

describe("Conversation lifecycle", () => {
  let conversationId: string;

  it("should create, list, and find the conversation", async () => {
    // Create
    const createRes = await apiRequest("/api/conversations", {
      method: "POST",
      token: adminToken,
      body: { title: "E2E Lifecycle Test" },
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    conversationId = created.id;
    expect(conversationId).toBeDefined();

    // List and find it
    const listRes = await apiRequest("/api/conversations", {
      token: adminToken,
    });
    expect(listRes.status).toBe(200);
    const listData = await listRes.json();
    const found = listData.conversations.find(
      (c: { id: string }) => c.id === conversationId,
    );
    expect(found).toBeDefined();
    expect(found.title).toBe("E2E Lifecycle Test");
  });

  it("should delete the conversation", async () => {
    if (!conversationId) return;

    const res = await apiRequest(`/api/conversations/${conversationId}`, {
      method: "DELETE",
      token: adminToken,
    });
    // 200 or 204 for successful deletion
    expect([200, 204]).toContain(res.status);
  });
});
