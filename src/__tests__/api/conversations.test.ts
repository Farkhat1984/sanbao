import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const authMock = auth as any;
import { prisma } from "@/lib/prisma";
import { getUserPlanAndUsage } from "@/lib/usage";

// ─── Import route handlers ─────────────────────────────

import { GET, POST } from "@/app/api/conversations/route";
import {
  GET as GET_BY_ID,
  PUT as PUT_BY_ID,
  DELETE as DELETE_BY_ID,
} from "@/app/api/conversations/[id]/route";
import { POST as POST_MESSAGES } from "@/app/api/conversations/[id]/messages/route";

// ─── Helpers ────────────────────────────────────────────

function makeRequest(body?: unknown) {
  return new Request("http://localhost/api/conversations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("Conversations API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authMock).mockResolvedValue({
      user: { id: "user-1", email: "test@test.com", role: "USER" },
      expires: "",
    });
  });

  // ═══ GET /api/conversations ═══════════════════════════

  describe("GET /api/conversations", () => {
    it("should return 401 if not authenticated", async () => {
      vi.mocked(authMock).mockResolvedValueOnce(null);
      const res = await GET(new Request("http://localhost/api/conversations"));
      expect(res.status).toBe(401);
    });

    it("should return list of conversations", async () => {
      vi.mocked(prisma.conversation.findMany).mockResolvedValueOnce([
        {
          id: "conv-1",
          title: "Test chat",
          pinned: false,
          archived: false,
          createdAt: new Date("2025-01-01"),
          updatedAt: new Date("2025-01-02"),
          agentId: null,
          systemAgentId: null,
          agent: null,
          messages: [{ content: "Last message" }],
        },
      ] as never);

      const res = await GET(new Request("http://localhost/api/conversations"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.items).toHaveLength(1);
      expect(body.items[0].id).toBe("conv-1");
      expect(body.items[0].title).toBe("Test chat");
      expect(body.items[0].lastMessage).toBe("Last message");
      expect(body.items[0].agentId).toBeNull();
      expect(body.nextCursor).toBeNull();
    });

    it("should include agent info when available", async () => {
      vi.mocked(prisma.conversation.findMany).mockResolvedValueOnce([
        {
          id: "conv-2",
          title: "Agent chat",
          pinned: true,
          archived: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          agentId: "agent-1",
          systemAgentId: null,
          agent: { id: "agent-1", name: "Femida", icon: "Scale", iconColor: "#7C3AED", isSystem: true },
          messages: [],
        },
      ] as never);

      const res = await GET(new Request("http://localhost/api/conversations"));
      const body = await res.json();
      expect(body.items[0].agentName).toBe("Femida");
      expect(body.items[0].isSystemAgent).toBe(true);
    });

    it("should return empty array if no conversations", async () => {
      vi.mocked(prisma.conversation.findMany).mockResolvedValueOnce([]);
      const res = await GET(new Request("http://localhost/api/conversations"));
      const body = await res.json();
      expect(body.items).toEqual([]);
      expect(body.nextCursor).toBeNull();
    });
  });

  // ═══ POST /api/conversations ══════════════════════════

  describe("POST /api/conversations", () => {
    it("should return 401 if not authenticated", async () => {
      vi.mocked(authMock).mockResolvedValueOnce(null);
      const res = await POST(makeRequest({ title: "Test" }));
      expect(res.status).toBe(401);
    });

    it("should create a new conversation", async () => {
      vi.mocked(prisma.conversation.create).mockResolvedValueOnce({
        id: "new-conv",
        title: "My Chat",
        pinned: false,
        archived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: "user-1",
        agentId: null,
      } as never);

      const res = await POST(makeRequest({ title: "My Chat" }));
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.id).toBe("new-conv");
      expect(body.title).toBe("My Chat");
    });

    it("should use default title if none provided", async () => {
      vi.mocked(prisma.conversation.create).mockResolvedValueOnce({
        id: "conv-default",
        title: "Новый чат",
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: "user-1",
        agentId: null,
      } as never);

      await POST(makeRequest({ title: "" }));
      expect(prisma.conversation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ title: "Новый чат" }),
      });
    });

    it("should return 403 when conversation limit reached", async () => {
      vi.mocked(getUserPlanAndUsage).mockResolvedValueOnce({
        plan: { maxConversations: 5 },
        usage: {},
      } as never);
      vi.mocked(prisma.conversation.count).mockResolvedValueOnce(5);

      const res = await POST(makeRequest({ title: "Over limit" }));
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toContain("лимит");
    });

    it("should bypass limit for admin users", async () => {
      vi.mocked(authMock).mockResolvedValueOnce({
        user: { id: "admin-1", email: "admin@test.com", role: "ADMIN" },
        expires: "",
      });
      vi.mocked(getUserPlanAndUsage).mockResolvedValueOnce({
        plan: { maxConversations: 5 },
        usage: {},
      } as never);
      vi.mocked(prisma.conversation.create).mockResolvedValueOnce({
        id: "admin-conv",
        title: "Admin chat",
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: "admin-1",
        agentId: null,
      } as never);

      const res = await POST(makeRequest({ title: "Admin chat" }));
      // count should NOT be called for admin
      expect(prisma.conversation.count).not.toHaveBeenCalled();
      expect(res.status).toBe(201);
    });

    it("should associate agent if agentId provided", async () => {
      vi.mocked(prisma.agent.findFirst).mockResolvedValueOnce({
        id: "agent-1",
      } as never);
      vi.mocked(prisma.conversation.create).mockResolvedValueOnce({
        id: "agent-conv",
        title: "Agent Chat",
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: "user-1",
        agentId: "agent-1",
      } as never);
      vi.mocked(prisma.agent.findUnique).mockResolvedValueOnce({
        id: "agent-1",
        name: "Bot",
        icon: "Bot",
        iconColor: "#4F6EF7",
        isSystem: false,
      } as never);

      const res = await POST(makeRequest({ title: "Agent Chat", agentId: "agent-1" }));
      const body = await res.json();
      expect(body.agentId).toBe("agent-1");
      expect(body.agentName).toBe("Bot");
    });
  });

  // ═══ GET /api/conversations/[id] ══════════════════════

  describe("GET /api/conversations/[id]", () => {
    it("should return 401 if not authenticated", async () => {
      vi.mocked(authMock).mockResolvedValueOnce(null);
      const res = await GET_BY_ID(new Request("http://localhost"), makeParams("conv-1"));
      expect(res.status).toBe(401);
    });

    it("should return 404 if conversation not found", async () => {
      vi.mocked(prisma.conversation.findFirst).mockResolvedValueOnce(null);
      const res = await GET_BY_ID(new Request("http://localhost"), makeParams("nonexistent"));
      expect(res.status).toBe(404);
    });

    it("should return conversation with messages and artifacts", async () => {
      vi.mocked(prisma.conversation.findFirst).mockResolvedValueOnce({
        id: "conv-1",
        title: "Test",
        messages: [
          { id: "msg-1", role: "USER", content: "Hello", legalRefs: [], artifacts: [] },
          { id: "msg-2", role: "ASSISTANT", content: "Hi!", legalRefs: [], artifacts: [] },
        ],
        artifacts: [
          { id: "art-1", type: "DOCUMENT", title: "Doc", content: "Text", version: 1 },
        ],
      } as never);

      const res = await GET_BY_ID(new Request("http://localhost"), makeParams("conv-1"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.messages).toHaveLength(2);
      expect(body.artifacts).toHaveLength(1);
    });

    it("should verify user ownership", async () => {
      await GET_BY_ID(new Request("http://localhost"), makeParams("conv-1"));
      expect(prisma.conversation.findFirst).toHaveBeenCalledWith({
        where: { id: "conv-1", userId: "user-1" },
        include: expect.any(Object),
      });
    });
  });

  // ═══ PUT /api/conversations/[id] ══════════════════════

  describe("PUT /api/conversations/[id]", () => {
    it("should return 401 if not authenticated", async () => {
      vi.mocked(authMock).mockResolvedValueOnce(null);
      const req = new Request("http://localhost", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New" }),
      });
      const res = await PUT_BY_ID(req, makeParams("conv-1"));
      expect(res.status).toBe(401);
    });

    it("should update conversation title", async () => {
      vi.mocked(prisma.conversation.updateMany).mockResolvedValueOnce({ count: 1 } as never);
      const req = new Request("http://localhost", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Renamed" }),
      });
      const res = await PUT_BY_ID(req, makeParams("conv-1"));
      expect(res.status).toBe(200);
      expect(prisma.conversation.updateMany).toHaveBeenCalledWith({
        where: { id: "conv-1", userId: "user-1" },
        data: { title: "Renamed" },
      });
    });

    it("should update pinned status", async () => {
      vi.mocked(prisma.conversation.updateMany).mockResolvedValueOnce({ count: 1 } as never);
      const req = new Request("http://localhost", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned: true }),
      });
      await PUT_BY_ID(req, makeParams("conv-1"));
      expect(prisma.conversation.updateMany).toHaveBeenCalledWith({
        where: { id: "conv-1", userId: "user-1" },
        data: { pinned: true },
      });
    });

    it("should update archived status", async () => {
      vi.mocked(prisma.conversation.updateMany).mockResolvedValueOnce({ count: 1 } as never);
      const req = new Request("http://localhost", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: true }),
      });
      await PUT_BY_ID(req, makeParams("conv-1"));
      expect(prisma.conversation.updateMany).toHaveBeenCalledWith({
        where: { id: "conv-1", userId: "user-1" },
        data: { archived: true },
      });
    });
  });

  // ═══ DELETE /api/conversations/[id] ═══════════════════

  describe("DELETE /api/conversations/[id]", () => {
    it("should return 401 if not authenticated", async () => {
      vi.mocked(authMock).mockResolvedValueOnce(null);
      const res = await DELETE_BY_ID(new Request("http://localhost"), makeParams("conv-1"));
      expect(res.status).toBe(401);
    });

    it("should delete conversation", async () => {
      vi.mocked(prisma.conversation.deleteMany).mockResolvedValueOnce({ count: 1 } as never);
      const res = await DELETE_BY_ID(new Request("http://localhost"), makeParams("conv-1"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(prisma.conversation.deleteMany).toHaveBeenCalledWith({
        where: { id: "conv-1", userId: "user-1" },
      });
    });

    it("should verify user ownership on delete", async () => {
      vi.mocked(prisma.conversation.deleteMany).mockResolvedValueOnce({ count: 0 } as never);
      const res = await DELETE_BY_ID(new Request("http://localhost"), makeParams("other-conv"));
      expect(res.status).toBe(200); // deleteMany returns success even if 0 matched
      expect(prisma.conversation.deleteMany).toHaveBeenCalledWith({
        where: { id: "other-conv", userId: "user-1" },
      });
    });
  });

  // ═══ POST /api/conversations/[id]/messages ════════════

  describe("POST /api/conversations/[id]/messages", () => {
    beforeEach(() => {
      vi.mocked(prisma.conversation.findFirst).mockResolvedValue({
        id: "conv-1",
      } as never);
      vi.mocked(prisma.message.createMany).mockResolvedValue({ count: 2 } as never);
      vi.mocked(prisma.message.count).mockResolvedValue(2);
      vi.mocked(prisma.conversation.update).mockResolvedValue({} as never);
    });

    it("should return 401 if not authenticated", async () => {
      vi.mocked(authMock).mockResolvedValueOnce(null);
      const req = new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "USER", content: "Hi" }] }),
      });
      const res = await POST_MESSAGES(req, makeParams("conv-1"));
      expect(res.status).toBe(401);
    });

    it("should return 404 if conversation not found", async () => {
      vi.mocked(prisma.conversation.findFirst).mockResolvedValueOnce(null);
      const req = new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "USER", content: "Hi" }] }),
      });
      const res = await POST_MESSAGES(req, makeParams("nonexistent"));
      expect(res.status).toBe(404);
    });

    it("should return 400 if messages array is empty", async () => {
      const req = new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [] }),
      });
      const res = await POST_MESSAGES(req, makeParams("conv-1"));
      expect(res.status).toBe(400);
    });

    it("should batch insert messages", async () => {
      const messages = [
        { role: "USER", content: "Hello" },
        { role: "ASSISTANT", content: "Hi there!" },
      ];
      const req = new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
      });

      const res = await POST_MESSAGES(req, makeParams("conv-1"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.count).toBe(2);
      expect(prisma.message.createMany).toHaveBeenCalled();
    });

    it("should auto-title from first user message", async () => {
      vi.mocked(prisma.message.count).mockResolvedValueOnce(2);
      const messages = [
        { role: "USER", content: "What is the meaning of life?" },
        { role: "ASSISTANT", content: "42" },
      ];
      const req = new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
      });

      await POST_MESSAGES(req, makeParams("conv-1"));
      expect(prisma.conversation.update).toHaveBeenCalledWith({
        where: { id: "conv-1" },
        data: expect.objectContaining({
          title: "What is the meaning of life?",
        }),
      });
    });

    it("should save plan content if present", async () => {
      const messages = [
        { role: "USER", content: "Plan something" },
        { role: "ASSISTANT", content: "Here's the plan", planContent: "**Ключевые решения:**\nDecision 1" },
      ];
      const req = new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
      });

      await POST_MESSAGES(req, makeParams("conv-1"));
      expect(prisma.conversationPlan.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          conversationId: "conv-1",
          content: "**Ключевые решения:**\nDecision 1",
          isActive: true,
        }),
      });
    });
  });
});
