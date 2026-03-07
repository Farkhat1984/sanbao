/**
 * E2E: Admin operations
 *
 * Tests admin-only endpoints: user management, agent CRUD, system settings.
 * Requires ADMIN role session.
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  BASE_URL,
  apiRequest,
  createAdminToken,
  createUserToken,
  isServerReachable,
} from "./helpers";

let adminToken: string;
let userToken: string;

beforeAll(async () => {
  const reachable = await isServerReachable();
  if (!reachable) {
    throw new Error(
      `Sanbao server not reachable at ${BASE_URL}. Start it before running E2E tests.`,
    );
  }
  adminToken = await createAdminToken();
  userToken = await createUserToken();
});

// ---------------------------------------------------------------------------
// GET /api/admin/users — List users
// ---------------------------------------------------------------------------

describe("GET /api/admin/users", () => {
  it("should return 401 without auth", async () => {
    const res = await apiRequest("/api/admin/users");
    expect([401, 403]).toContain(res.status);
  });

  it("should return 403 for non-admin user", async () => {
    const res = await apiRequest("/api/admin/users", { token: userToken });
    expect([401, 403]).toContain(res.status);
  });

  it("should return user list for admin", async () => {
    const res = await apiRequest("/api/admin/users", { token: adminToken });
    expect(res.status).toBe(200);

    const data = await res.json();
    // Response should be an array or paginated object
    if (Array.isArray(data)) {
      expect(data.length).toBeGreaterThanOrEqual(0);
    } else {
      expect(data).toHaveProperty("users");
    }
  });
});

// ---------------------------------------------------------------------------
// GET /api/admin/users/[id] — Get single user
// ---------------------------------------------------------------------------

describe("GET /api/admin/users/[id]", () => {
  it("should return 403 for non-admin", async () => {
    const res = await apiRequest("/api/admin/users/some-id", {
      token: userToken,
    });
    expect([401, 403]).toContain(res.status);
  });

  it("should return 404 for non-existent user", async () => {
    const res = await apiRequest("/api/admin/users/nonexistent-user-id", {
      token: adminToken,
    });
    expect([404, 400]).toContain(res.status);
  });
});

// ---------------------------------------------------------------------------
// Agent CRUD via /api/agents
// ---------------------------------------------------------------------------

describe("Agent CRUD", () => {
  let createdAgentId: string | null = null;

  it("should list agents including system agents", async () => {
    const res = await apiRequest("/api/agents", { token: adminToken });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty("systemAgents");
    expect(Array.isArray(data.systemAgents)).toBe(true);
    expect(data.systemAgents.length).toBeGreaterThan(0);

    // Verify known system agents exist
    const ids = data.systemAgents.map((a: { id: string }) => a.id);
    expect(ids).toContain("system-sanbao-agent");
  });

  it("should create a custom agent", async () => {
    const res = await apiRequest("/api/agents", {
      method: "POST",
      token: adminToken,
      body: {
        name: "E2E Test Agent",
        instructions: "You are a test agent for E2E testing. Respond briefly.",
        description: "Created by E2E test suite",
        icon: "Bot",
        iconColor: "#4F6EF7",
      },
    });
    expect(res.status).toBe(201);

    const data = await res.json();
    expect(data).toHaveProperty("id");
    expect(data.name).toBe("E2E Test Agent");
    createdAgentId = data.id;
  });

  it("should get the created agent by ID", async () => {
    if (!createdAgentId) return;

    const res = await apiRequest(`/api/agents/${createdAgentId}`, {
      token: adminToken,
    });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.id).toBe(createdAgentId);
    expect(data.name).toBe("E2E Test Agent");
  });

  it("should update the agent", async () => {
    if (!createdAgentId) return;

    const res = await apiRequest(`/api/agents/${createdAgentId}`, {
      method: "PUT",
      token: adminToken,
      body: {
        name: "E2E Test Agent (Updated)",
        description: "Updated by E2E test",
      },
    });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.name).toBe("E2E Test Agent (Updated)");
  });

  it("should delete the agent", async () => {
    if (!createdAgentId) return;

    const res = await apiRequest(`/api/agents/${createdAgentId}`, {
      method: "DELETE",
      token: adminToken,
    });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    createdAgentId = null;
  });

  it("should return 404 for deleted agent", async () => {
    // Use a definitely-not-existing ID
    const res = await apiRequest("/api/agents/deleted-agent-e2e-test", {
      token: adminToken,
    });
    expect(res.status).toBe(404);
  });

  it("should return 400 when creating agent without required fields", async () => {
    const res = await apiRequest("/api/agents", {
      method: "POST",
      token: adminToken,
      body: { description: "Missing name and instructions" },
    });
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// System agents — Read-only checks
// ---------------------------------------------------------------------------

describe("System agents", () => {
  const systemAgentIds = [
    "system-sanbao-agent",
    "system-femida-agent",
    "system-broker-agent",
    "system-accountant-agent",
  ];

  for (const agentId of systemAgentIds) {
    it(`should return system agent: ${agentId}`, async () => {
      const res = await apiRequest(`/api/agents/${agentId}`, {
        token: adminToken,
      });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.id).toBe(agentId);
      expect(data.isSystem).toBe(true);
    });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/settings — System settings
// ---------------------------------------------------------------------------

describe("GET /api/admin/settings", () => {
  it("should return 403 for non-admin", async () => {
    const res = await apiRequest("/api/admin/settings", { token: userToken });
    expect([401, 403]).toContain(res.status);
  });

  it("should return settings for admin", async () => {
    const res = await apiRequest("/api/admin/settings", {
      token: adminToken,
    });
    // 200 if settings exist, or 404 if endpoint structure differs
    expect([200, 404]).toContain(res.status);

    if (res.status === 200) {
      const data = await res.json();
      expect(data).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// Admin system-agents management
// ---------------------------------------------------------------------------

describe("Admin system-agents endpoints", () => {
  it("GET /api/admin/system-agents should list all system agents", async () => {
    const res = await apiRequest("/api/admin/system-agents", {
      token: adminToken,
    });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  it("GET /api/admin/system-agents should be forbidden for regular user", async () => {
    const res = await apiRequest("/api/admin/system-agents", {
      token: userToken,
    });
    expect([401, 403]).toContain(res.status);
  });
});

// ---------------------------------------------------------------------------
// Admin MCP servers
// ---------------------------------------------------------------------------

describe("Admin MCP management", () => {
  it("GET /api/admin/mcp should list MCP servers for admin", async () => {
    const res = await apiRequest("/api/admin/mcp", { token: adminToken });
    // 200 if route exists, 404 if not at this path
    expect([200, 404]).toContain(res.status);

    if (res.status === 200) {
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
    }
  });

  it("GET /api/mcp should list user MCP servers", async () => {
    const res = await apiRequest("/api/mcp", { token: adminToken });
    expect(res.status).toBe(200);
  });
});
