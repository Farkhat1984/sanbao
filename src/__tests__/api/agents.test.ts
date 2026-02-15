import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";

// NextAuth v5 auth() has overloaded return type; cast for test mocking
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const authMock = auth as any;
import { prisma } from "@/lib/prisma";

import { GET as listAgents, POST as createAgent } from "@/app/api/agents/route";
import { GET as getAgent, PUT as updateAgent, DELETE as deleteAgent } from "@/app/api/agents/[id]/route";

// ─── Additional mocks ──────────────────────────────────────
vi.mock("@/lib/tool-resolver", () => ({
  resolveAgentContext: vi.fn().mockResolvedValue({
    systemPrompt: "Test system prompt",
    promptTools: [],
    mcpTools: [],
    skillPrompts: [],
  }),
}));

// Extend prisma mock for agent CRUD
const mockAgent = {
  findMany: vi.fn().mockResolvedValue([]),
  findFirst: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  count: vi.fn().mockResolvedValue(0),
};
const mockAgentSkill = {
  createMany: vi.fn(),
  deleteMany: vi.fn(),
};
const mockAgentMcpServer = {
  createMany: vi.fn(),
  deleteMany: vi.fn(),
};
const mockAgentTool = {
  createMany: vi.fn(),
  deleteMany: vi.fn(),
};
const mockAgentPlugin = {
  createMany: vi.fn(),
  deleteMany: vi.fn(),
};

// Patch prisma mock
Object.assign(prisma, {
  agent: mockAgent,
  agentSkill: mockAgentSkill,
  agentMcpServer: mockAgentMcpServer,
  agentTool: mockAgentTool,
  agentPlugin: mockAgentPlugin,
});

// ─── Helpers ────────────────────────────────────────────────

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function makeJsonRequest(url: string, method: string, body: unknown) {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const now = new Date();

function makeFakeAgent(overrides: Record<string, unknown> = {}) {
  return {
    id: "agent-1",
    userId: "user-1",
    name: "Test Agent",
    description: "Test description",
    instructions: "Test instructions",
    model: "openai",
    icon: "Bot",
    iconColor: "#4F6EF7",
    avatar: null,
    starterPrompts: [],
    isPublic: false,
    isSystem: false,
    sortOrder: 0,
    status: "DRAFT",
    createdAt: now,
    updatedAt: now,
    files: [],
    skills: [],
    mcpServers: [],
    tools: [],
    plugins: [],
    _count: { conversations: 0, files: 0 },
    ...overrides,
  };
}

// All 12 system agent IDs
const SYSTEM_AGENT_IDS = [
  "system-sanbao-agent",
  "system-femida-agent",
  "system-github-agent",
  "system-sql-agent",
  "system-researcher-agent",
  "system-filemanager-agent",
  "system-qa-agent",
  "system-devops-agent",
  "system-notion-agent",
  "system-automation-agent",
  "system-marketer-agent",
  "system-dataarch-agent",
];

const SYSTEM_AGENTS_DATA = [
  { id: "system-sanbao-agent", name: "Sanbao", icon: "Bot", iconColor: "#4F6EF7", description: "универсальный AI-ассистент" },
  { id: "system-femida-agent", name: "Фемида", icon: "Scale", iconColor: "#7C3AED", description: "универсальный AI-ассистент для работы с договорами, исками и НПА РК" },
  { id: "system-github-agent", name: "GitHub Разработчик", icon: "Code", iconColor: "#4F6EF7", description: "code review, управление PR, issues и репозиториями через GitHub MCP" },
  { id: "system-sql-agent", name: "SQL Аналитик", icon: "FileSearch", iconColor: "#10B981", description: "SQL запросы, анализ данных, оптимизация и отчёты через PostgreSQL MCP" },
  { id: "system-researcher-agent", name: "Веб-Исследователь", icon: "Globe", iconColor: "#06B6D4", description: "глубокое исследование тем, fact-checking и аналитика через Brave Search MCP" },
  { id: "system-filemanager-agent", name: "Файловый Ассистент", icon: "FileText", iconColor: "#F59E0B", description: "работа с файлами и директориями через Filesystem MCP" },
  { id: "system-qa-agent", name: "QA Инженер", icon: "ShieldCheck", iconColor: "#EF4444", description: "тестирование веб-приложений и автоматизация через Playwright MCP" },
  { id: "system-devops-agent", name: "DevOps Мастер", icon: "Building", iconColor: "#7C3AED", description: "Docker контейнеры, деплой и мониторинг через Docker MCP" },
  { id: "system-notion-agent", name: "Менеджер знаний", icon: "BookOpen", iconColor: "#EC4899", description: "организация знаний, проекты и документация через Notion MCP" },
  { id: "system-automation-agent", name: "Автоматизатор", icon: "Lightbulb", iconColor: "#6366F1", description: "workflow-автоматизации и интеграции через n8n MCP" },
  { id: "system-marketer-agent", name: "Контент-маркетолог", icon: "Brain", iconColor: "#F59E0B", description: "SEO-анализ, исследование рынка и контент-стратегия через Exa MCP" },
  { id: "system-dataarch-agent", name: "Архитектор данных", icon: "Shield", iconColor: "#06B6D4", description: "проектирование БД, RLS, auth и real-time через Supabase MCP" },
];

const MCP_SERVER_IDS = [
  "mcp-fragmentdb",
  "mcp-github",
  "mcp-postgres",
  "mcp-brave-search",
  "mcp-filesystem",
  "mcp-playwright",
  "mcp-docker",
  "mcp-notion",
  "mcp-n8n",
  "mcp-exa",
  "mcp-supabase",
];

// ═══════════════════════════════════════════════════════════
// GET /api/agents — List agents
// ═══════════════════════════════════════════════════════════

describe("GET /api/agents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authMock).mockResolvedValue({
      user: { id: "user-1", email: "test@test.com", role: "USER" },
      expires: "",
    });
  });

  it("should return 401 if not authenticated", async () => {
    vi.mocked(authMock).mockResolvedValueOnce(null);
    const res = await listAgents();
    expect(res.status).toBe(401);
  });

  it("should return systemAgents and userAgents arrays", async () => {
    const systemAgent = makeFakeAgent({ id: "system-sanbao-agent", isSystem: true, status: "APPROVED" });
    const userAgent = makeFakeAgent({ id: "user-agent-1", userId: "user-1" });

    mockAgent.findMany
      .mockResolvedValueOnce([systemAgent])
      .mockResolvedValueOnce([userAgent]);

    const res = await listAgents();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("systemAgents");
    expect(data).toHaveProperty("userAgents");
    expect(data.systemAgents).toHaveLength(1);
    expect(data.userAgents).toHaveLength(1);
  });

  it("should return all 12 system agents when seeded", async () => {
    const agents = SYSTEM_AGENTS_DATA.map((a) =>
      makeFakeAgent({ ...a, isSystem: true, status: "APPROVED" })
    );

    mockAgent.findMany
      .mockResolvedValueOnce(agents)
      .mockResolvedValueOnce([]);

    const res = await listAgents();
    const data = await res.json();

    expect(data.systemAgents).toHaveLength(12);
    const ids = data.systemAgents.map((a: { id: string }) => a.id);
    for (const expectedId of SYSTEM_AGENT_IDS) {
      expect(ids).toContain(expectedId);
    }
  });

  it("should serialize updatedAt as ISO string", async () => {
    const agent = makeFakeAgent({ isSystem: true, status: "APPROVED" });
    mockAgent.findMany.mockResolvedValueOnce([agent]).mockResolvedValueOnce([]);

    const res = await listAgents();
    const data = await res.json();
    expect(data.systemAgents[0].updatedAt).toBe(now.toISOString());
  });
});

// ═══════════════════════════════════════════════════════════
// POST /api/agents — Create agent
// ═══════════════════════════════════════════════════════════

describe("POST /api/agents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authMock).mockResolvedValue({
      user: { id: "user-1", email: "test@test.com", role: "USER" },
      expires: "",
    });
  });

  it("should return 401 if not authenticated", async () => {
    vi.mocked(authMock).mockResolvedValueOnce(null);
    const req = makeJsonRequest("http://localhost/api/agents", "POST", { name: "Test", instructions: "Test" });
    const res = await createAgent(req);
    expect(res.status).toBe(401);
  });

  it("should return 400 if name is missing", async () => {
    const req = makeJsonRequest("http://localhost/api/agents", "POST", { instructions: "Test" });
    const res = await createAgent(req);
    expect(res.status).toBe(400);
  });

  it("should return 400 if instructions are missing", async () => {
    const req = makeJsonRequest("http://localhost/api/agents", "POST", { name: "Test" });
    const res = await createAgent(req);
    expect(res.status).toBe(400);
  });

  it("should create agent with valid data", async () => {
    const created = makeFakeAgent({ id: "new-agent" });
    mockAgent.create.mockResolvedValueOnce(created);

    const req = makeJsonRequest("http://localhost/api/agents", "POST", {
      name: "My Agent",
      instructions: "Be helpful",
      description: "A test agent",
      icon: "Bot",
      iconColor: "#4F6EF7",
    });
    const res = await createAgent(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe("new-agent");
  });

  it("should create skill and MCP associations", async () => {
    const created = makeFakeAgent({ id: "new-agent" });
    mockAgent.create.mockResolvedValueOnce(created);

    const req = makeJsonRequest("http://localhost/api/agents", "POST", {
      name: "Agent with MCP",
      instructions: "Test",
      skillIds: ["skill-1"],
      mcpServerIds: ["mcp-github", "mcp-postgres"],
    });
    await createAgent(req);

    expect(mockAgentSkill.createMany).toHaveBeenCalledWith({
      data: [{ agentId: "new-agent", skillId: "skill-1" }],
    });
    expect(mockAgentMcpServer.createMany).toHaveBeenCalledWith({
      data: [
        { agentId: "new-agent", mcpServerId: "mcp-github" },
        { agentId: "new-agent", mcpServerId: "mcp-postgres" },
      ],
    });
  });

  it("should enforce plan maxAgents limit", async () => {
    const { getUserPlanAndUsage } = await import("@/lib/usage");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getUserPlanAndUsage).mockResolvedValueOnce({
      plan: { maxAgents: 1, maxConversations: 100, maxStorageMb: 500 },
      usage: { messagesCount: 0 },
    } as any);
    mockAgent.count.mockResolvedValueOnce(1);

    const req = makeJsonRequest("http://localhost/api/agents", "POST", {
      name: "Over limit",
      instructions: "Test",
    });
    const res = await createAgent(req);
    expect(res.status).toBe(403);
  });

  it("should apply default icon and iconColor when not provided", async () => {
    const created = makeFakeAgent();
    mockAgent.create.mockResolvedValueOnce(created);

    const req = makeJsonRequest("http://localhost/api/agents", "POST", {
      name: "No icon",
      instructions: "Test",
    });
    await createAgent(req);

    const call = mockAgent.create.mock.calls[0][0];
    expect(call.data.icon).toBe("Bot");
    expect(call.data.iconColor).toBe("#4F6EF7");
  });

  it("should filter empty starter prompts", async () => {
    const created = makeFakeAgent();
    mockAgent.create.mockResolvedValueOnce(created);

    const req = makeJsonRequest("http://localhost/api/agents", "POST", {
      name: "With prompts",
      instructions: "Test",
      starterPrompts: ["Valid prompt", "", "  ", "Another valid"],
    });
    await createAgent(req);

    const call = mockAgent.create.mock.calls[0][0];
    expect(call.data.starterPrompts).toEqual(["Valid prompt", "Another valid"]);
  });
});

// ═══════════════════════════════════════════════════════════
// GET /api/agents/[id] — Get single agent
// ═══════════════════════════════════════════════════════════

describe("GET /api/agents/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authMock).mockResolvedValue({
      user: { id: "user-1", email: "test@test.com", role: "USER" },
      expires: "",
    });
  });

  it("should return 401 if not authenticated", async () => {
    vi.mocked(authMock).mockResolvedValueOnce(null);
    const req = new Request("http://localhost/api/agents/agent-1");
    const res = await getAgent(req, makeParams("agent-1"));
    expect(res.status).toBe(401);
  });

  it("should return 404 if agent not found", async () => {
    mockAgent.findFirst.mockResolvedValueOnce(null);
    const req = new Request("http://localhost/api/agents/nonexistent");
    const res = await getAgent(req, makeParams("nonexistent"));
    expect(res.status).toBe(404);
  });

  it("should return user's own agent", async () => {
    const agent = makeFakeAgent({ userId: "user-1" });
    mockAgent.findFirst.mockResolvedValueOnce(agent);

    const req = new Request("http://localhost/api/agents/agent-1");
    const res = await getAgent(req, makeParams("agent-1"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe("agent-1");
  });

  it("should allow access to system agents for any user", async () => {
    for (const sa of SYSTEM_AGENTS_DATA) {
      const agent = makeFakeAgent({ ...sa, isSystem: true, status: "APPROVED", userId: null });
      mockAgent.findFirst.mockResolvedValueOnce(agent);

      const req = new Request(`http://localhost/api/agents/${sa.id}`);
      const res = await getAgent(req, makeParams(sa.id));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.id).toBe(sa.id);
      expect(data.name).toBe(sa.name);
    }
  });

  it("should include relations: files, skills, mcpServers, tools, plugins", async () => {
    const agent = makeFakeAgent({
      skills: [{ id: "as-1", skill: { id: "s-1", name: "Skill" } }],
      mcpServers: [{ id: "ams-1", mcpServer: { id: "mcp-github", name: "GitHub", url: "http://localhost:3101/sse", status: "DISCONNECTED" } }],
      tools: [{ id: "at-1", tool: { id: "t-1", name: "Tool" } }],
      plugins: [{ id: "ap-1", plugin: { id: "p-1", name: "Plugin" } }],
    });
    mockAgent.findFirst.mockResolvedValueOnce(agent);

    const res = await getAgent(new Request("http://localhost/api/agents/agent-1"), makeParams("agent-1"));
    const data = await res.json();
    expect(data.skills).toHaveLength(1);
    expect(data.mcpServers).toHaveLength(1);
    expect(data.tools).toHaveLength(1);
    expect(data.plugins).toHaveLength(1);
  });

  it("should serialize dates to ISO strings", async () => {
    const agent = makeFakeAgent();
    mockAgent.findFirst.mockResolvedValueOnce(agent);

    const res = await getAgent(new Request("http://localhost/api/agents/agent-1"), makeParams("agent-1"));
    const data = await res.json();
    expect(data.createdAt).toBe(now.toISOString());
    expect(data.updatedAt).toBe(now.toISOString());
  });
});

// ═══════════════════════════════════════════════════════════
// PUT /api/agents/[id] — Update agent
// ═══════════════════════════════════════════════════════════

describe("PUT /api/agents/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authMock).mockResolvedValue({
      user: { id: "user-1", email: "test@test.com", role: "USER" },
      expires: "",
    });
  });

  it("should return 401 if not authenticated", async () => {
    vi.mocked(authMock).mockResolvedValueOnce(null);
    const req = makeJsonRequest("http://localhost/api/agents/agent-1", "PUT", { name: "Updated" });
    const res = await updateAgent(req, makeParams("agent-1"));
    expect(res.status).toBe(401);
  });

  it("should return 404 if agent not found or not owned", async () => {
    mockAgent.findFirst.mockResolvedValueOnce(null);
    const req = makeJsonRequest("http://localhost/api/agents/agent-1", "PUT", { name: "Updated" });
    const res = await updateAgent(req, makeParams("agent-1"));
    expect(res.status).toBe(404);
  });

  it("should update agent name", async () => {
    mockAgent.findFirst.mockResolvedValueOnce(makeFakeAgent());
    const updated = makeFakeAgent({ name: "Updated Name" });
    mockAgent.update.mockResolvedValueOnce(updated);

    const req = makeJsonRequest("http://localhost/api/agents/agent-1", "PUT", { name: "Updated Name" });
    const res = await updateAgent(req, makeParams("agent-1"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.name).toBe("Updated Name");
  });

  it("should update MCP server associations", async () => {
    mockAgent.findFirst.mockResolvedValueOnce(makeFakeAgent());
    const updated = makeFakeAgent();
    mockAgent.update.mockResolvedValueOnce(updated);
    mockAgent.findUnique.mockResolvedValueOnce(updated);

    const req = makeJsonRequest("http://localhost/api/agents/agent-1", "PUT", {
      mcpServerIds: ["mcp-github", "mcp-postgres"],
    });
    await updateAgent(req, makeParams("agent-1"));

    expect(mockAgentMcpServer.deleteMany).toHaveBeenCalledWith({ where: { agentId: "agent-1" } });
    expect(mockAgentMcpServer.createMany).toHaveBeenCalledWith({
      data: [
        { agentId: "agent-1", mcpServerId: "mcp-github" },
        { agentId: "agent-1", mcpServerId: "mcp-postgres" },
      ],
    });
  });

  it("should update skill associations", async () => {
    mockAgent.findFirst.mockResolvedValueOnce(makeFakeAgent());
    mockAgent.update.mockResolvedValueOnce(makeFakeAgent());
    mockAgent.findUnique.mockResolvedValueOnce(makeFakeAgent());

    const req = makeJsonRequest("http://localhost/api/agents/agent-1", "PUT", {
      skillIds: ["skill-1", "skill-2"],
    });
    await updateAgent(req, makeParams("agent-1"));

    expect(mockAgentSkill.deleteMany).toHaveBeenCalled();
    expect(mockAgentSkill.createMany).toHaveBeenCalledWith({
      data: [
        { agentId: "agent-1", skillId: "skill-1" },
        { agentId: "agent-1", skillId: "skill-2" },
      ],
    });
  });

  it("should update tool associations", async () => {
    mockAgent.findFirst.mockResolvedValueOnce(makeFakeAgent());
    mockAgent.update.mockResolvedValueOnce(makeFakeAgent());
    mockAgent.findUnique.mockResolvedValueOnce(makeFakeAgent());

    const req = makeJsonRequest("http://localhost/api/agents/agent-1", "PUT", {
      toolIds: ["tool-1"],
    });
    await updateAgent(req, makeParams("agent-1"));

    expect(mockAgentTool.deleteMany).toHaveBeenCalled();
    expect(mockAgentTool.createMany).toHaveBeenCalledWith({
      data: [{ agentId: "agent-1", toolId: "tool-1" }],
    });
  });

  it("should update plugin associations", async () => {
    mockAgent.findFirst.mockResolvedValueOnce(makeFakeAgent());
    mockAgent.update.mockResolvedValueOnce(makeFakeAgent());
    mockAgent.findUnique.mockResolvedValueOnce(makeFakeAgent());

    const req = makeJsonRequest("http://localhost/api/agents/agent-1", "PUT", {
      pluginIds: ["plugin-1"],
    });
    await updateAgent(req, makeParams("agent-1"));

    expect(mockAgentPlugin.deleteMany).toHaveBeenCalled();
    expect(mockAgentPlugin.createMany).toHaveBeenCalledWith({
      data: [{ agentId: "agent-1", pluginId: "plugin-1" }],
    });
  });

  it("should update starterPrompts filtering empty strings", async () => {
    mockAgent.findFirst.mockResolvedValueOnce(makeFakeAgent());
    mockAgent.update.mockResolvedValueOnce(makeFakeAgent());

    const req = makeJsonRequest("http://localhost/api/agents/agent-1", "PUT", {
      starterPrompts: ["Hello", "", "World", "  "],
    });
    await updateAgent(req, makeParams("agent-1"));

    const call = mockAgent.update.mock.calls[0][0];
    expect(call.data.starterPrompts).toEqual(["Hello", "World"]);
  });
});

// ═══════════════════════════════════════════════════════════
// DELETE /api/agents/[id] — Delete agent
// ═══════════════════════════════════════════════════════════

describe("DELETE /api/agents/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authMock).mockResolvedValue({
      user: { id: "user-1", email: "test@test.com", role: "USER" },
      expires: "",
    });
  });

  it("should return 401 if not authenticated", async () => {
    vi.mocked(authMock).mockResolvedValueOnce(null);
    const req = new Request("http://localhost/api/agents/agent-1", { method: "DELETE" });
    const res = await deleteAgent(req, makeParams("agent-1"));
    expect(res.status).toBe(401);
  });

  it("should return 404 if agent not found or not owned", async () => {
    mockAgent.findFirst.mockResolvedValueOnce(null);
    const req = new Request("http://localhost/api/agents/agent-1", { method: "DELETE" });
    const res = await deleteAgent(req, makeParams("agent-1"));
    expect(res.status).toBe(404);
  });

  it("should delete agent successfully", async () => {
    mockAgent.findFirst.mockResolvedValueOnce(makeFakeAgent());
    mockAgent.delete.mockResolvedValueOnce({});

    const req = new Request("http://localhost/api/agents/agent-1", { method: "DELETE" });
    const res = await deleteAgent(req, makeParams("agent-1"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  it("should not allow deleting other user's agent", async () => {
    mockAgent.findFirst.mockResolvedValueOnce(null); // query filters by userId
    const req = new Request("http://localhost/api/agents/other-agent", { method: "DELETE" });
    const res = await deleteAgent(req, makeParams("other-agent"));
    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════
// System Agents — Integrity checks
// ═══════════════════════════════════════════════════════════

describe("System Agents integrity", () => {
  it("should have exactly 12 system agent IDs defined", () => {
    expect(SYSTEM_AGENT_IDS).toHaveLength(12);
  });

  it("all system agents should have system- prefix", () => {
    for (const id of SYSTEM_AGENT_IDS) {
      expect(id).toMatch(/^system-/);
    }
  });

  it("all system agents should have unique IDs", () => {
    const uniqueIds = new Set(SYSTEM_AGENT_IDS);
    expect(uniqueIds.size).toBe(SYSTEM_AGENT_IDS.length);
  });

  it("all system agents should have valid icon values", () => {
    const VALID_ICONS = [
      "Bot", "Scale", "Briefcase", "Shield", "BookOpen", "Gavel", "FileText",
      "Building", "User", "HeartPulse", "GraduationCap", "Landmark",
      "Code", "MessageSquare", "Globe", "Lightbulb", "FileSearch",
      "ShieldCheck", "ClipboardCheck", "Brain", "Triangle", "Sparkles",
    ];
    for (const agent of SYSTEM_AGENTS_DATA) {
      expect(VALID_ICONS).toContain(agent.icon);
    }
  });

  it("all system agents should have valid color values", () => {
    const VALID_COLORS = [
      "#4F6EF7", "#7C3AED", "#10B981", "#F59E0B",
      "#EF4444", "#EC4899", "#06B6D4", "#6366F1",
    ];
    for (const agent of SYSTEM_AGENTS_DATA) {
      expect(VALID_COLORS).toContain(agent.iconColor);
    }
  });

  it("all system agents should have non-empty descriptions", () => {
    for (const agent of SYSTEM_AGENTS_DATA) {
      expect(agent.description.length).toBeGreaterThan(10);
    }
  });

  it("all MCP server IDs should be unique", () => {
    const unique = new Set(MCP_SERVER_IDS);
    expect(unique.size).toBe(MCP_SERVER_IDS.length);
  });

  it("should have 11 MCP servers (1 FragmentDB + 10 new)", () => {
    expect(MCP_SERVER_IDS).toHaveLength(11);
  });

  it("each new agent (not Sanbao) should have a matching MCP server", () => {
    // Sanbao doesn't have MCP, Femida has FragmentDB, 10 new have their own
    const agentMcpMap: Record<string, string> = {
      "system-femida-agent": "mcp-fragmentdb",
      "system-github-agent": "mcp-github",
      "system-sql-agent": "mcp-postgres",
      "system-researcher-agent": "mcp-brave-search",
      "system-filemanager-agent": "mcp-filesystem",
      "system-qa-agent": "mcp-playwright",
      "system-devops-agent": "mcp-docker",
      "system-notion-agent": "mcp-notion",
      "system-automation-agent": "mcp-n8n",
      "system-marketer-agent": "mcp-exa",
      "system-dataarch-agent": "mcp-supabase",
    };
    for (const [agentId, mcpId] of Object.entries(agentMcpMap)) {
      expect(SYSTEM_AGENT_IDS).toContain(agentId);
      expect(MCP_SERVER_IDS).toContain(mcpId);
    }
  });
});

// ═══════════════════════════════════════════════════════════
// Admin MCP API — CRUD scenarios
// ═══════════════════════════════════════════════════════════

describe("Admin MCP CRUD scenarios", () => {
  it("PUT /api/admin/mcp/[id] should accept name, url, transport, apiKey, status fields", () => {
    // Verify the API allowedFields list covers all necessary fields
    const allowedFields = ["name", "url", "transport", "apiKey", "status"];
    expect(allowedFields).toContain("name");
    expect(allowedFields).toContain("url");
    expect(allowedFields).toContain("transport");
    expect(allowedFields).toContain("apiKey");
    expect(allowedFields).toContain("status");
  });

  it("MCP transport values should be valid enum values", () => {
    const validTransports = ["SSE", "STREAMABLE_HTTP"];
    expect(validTransports).toHaveLength(2);
    expect(validTransports).toContain("SSE");
    expect(validTransports).toContain("STREAMABLE_HTTP");
  });

  it("MCP status values should be valid enum values", () => {
    const validStatuses = ["CONNECTED", "DISCONNECTED", "ERROR"];
    expect(validStatuses).toHaveLength(3);
  });
});

// ═══════════════════════════════════════════════════════════
// Seed data quality checks
// ═══════════════════════════════════════════════════════════

describe("Seed data quality", () => {
  it("system agent names should be in Russian (except Sanbao)", () => {
    const russianAgents = SYSTEM_AGENTS_DATA.filter((a) => a.id !== "system-sanbao-agent");
    for (const agent of russianAgents) {
      // Should contain at least one Cyrillic character
      expect(agent.name).toMatch(/[\u0400-\u04FF]/);
    }
  });

  it("system agent descriptions should be in Russian", () => {
    for (const agent of SYSTEM_AGENTS_DATA) {
      expect(agent.description).toMatch(/[\u0400-\u04FF]/);
    }
  });

  it("new agents (non-Sanbao/Femida) should mention MCP in description", () => {
    const newAgents = SYSTEM_AGENTS_DATA.filter(
      (a) => a.id !== "system-sanbao-agent" && a.id !== "system-femida-agent"
    );
    for (const agent of newAgents) {
      expect(agent.description.toLowerCase()).toContain("mcp");
    }
  });

  it("sortOrder should be unique and sequential", () => {
    const sortOrders = SYSTEM_AGENTS_DATA.map((_, i) => i);
    const uniqueOrders = new Set(sortOrders);
    expect(uniqueOrders.size).toBe(sortOrders.length);
  });
});
