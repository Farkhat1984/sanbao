import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserPlanAndUsage } from "@/lib/usage";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const authMock = auth as any;

// ─── Add userFile mock to prisma ────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(prisma as any).userFile = {
  findMany: vi.fn(),
  findFirst: vi.fn(),
  count: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

import { GET, POST } from "@/app/api/user-files/route";
import {
  GET as GET_BY_ID,
  PUT as PUT_BY_ID,
  DELETE as DELETE_BY_ID,
} from "@/app/api/user-files/[id]/route";

// ─── Helpers ────────────────────────────────────────────

function makeRequest(body?: unknown) {
  return new Request("http://localhost/api/user-files", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

const userId = "test-user-1";

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue({ user: { id: userId, role: "USER" } });
  (getUserPlanAndUsage as ReturnType<typeof vi.fn>).mockResolvedValue({
    plan: { maxAgents: 0 },
    usage: { messagesCount: 0 },
  });
});

// ─── Tests ──────────────────────────────────────────────

describe("GET /api/user-files", () => {
  it("returns list of user files", async () => {
    const files = [
      { id: "f1", name: "notes.md", description: null, fileType: "md", sizeBytes: 100, createdAt: new Date(), updatedAt: new Date() },
    ];
    (prisma.userFile.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(files);

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].name).toBe("notes.md");
  });

  it("returns 401 when unauthenticated", async () => {
    authMock.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });
});

describe("POST /api/user-files", () => {
  it("creates a file", async () => {
    const created = {
      id: "f1", userId, name: "test.md", description: null,
      content: "Hello world", fileType: "md", sizeBytes: 11,
      createdAt: new Date(), updatedAt: new Date(),
    };
    (prisma.userFile.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    (prisma.userFile.create as ReturnType<typeof vi.fn>).mockResolvedValue(created);

    const res = await POST(makeRequest({ name: "test.md", content: "Hello world" }));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.name).toBe("test.md");
  });

  it("rejects missing name", async () => {
    const res = await POST(makeRequest({ content: "data" }));
    expect(res.status).toBe(400);
  });

  it("rejects empty content", async () => {
    const res = await POST(makeRequest({ name: "test.md", content: "" }));
    expect(res.status).toBe(400);
  });

  it("rejects oversized content", async () => {
    const big = "x".repeat(100_001);
    (prisma.userFile.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    const res = await POST(makeRequest({ name: "big.md", content: big }));
    expect(res.status).toBe(400);
  });

  it("enforces file count limit", async () => {
    (prisma.userFile.count as ReturnType<typeof vi.fn>).mockResolvedValue(20);
    const res = await POST(makeRequest({ name: "test.md", content: "data" }));
    expect(res.status).toBe(403);
  });

  it("doubles limit for paid plans", async () => {
    (getUserPlanAndUsage as ReturnType<typeof vi.fn>).mockResolvedValue({
      plan: { maxAgents: 5 },
      usage: {},
    });
    (prisma.userFile.count as ReturnType<typeof vi.fn>).mockResolvedValue(25);
    (prisma.userFile.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "f2", userId, name: "test.md", content: "ok",
      fileType: "md", sizeBytes: 2,
      createdAt: new Date(), updatedAt: new Date(),
    });

    const res = await POST(makeRequest({ name: "test.md", content: "ok" }));
    expect(res.status).toBe(201);
  });
});

describe("GET /api/user-files/[id]", () => {
  it("returns file with content", async () => {
    const file = {
      id: "f1", userId, name: "notes.md", content: "# Notes",
      createdAt: new Date(), updatedAt: new Date(),
    };
    (prisma.userFile.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(file);

    const res = await GET_BY_ID(new Request("http://localhost"), makeParams("f1"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.content).toBe("# Notes");
  });

  it("returns 404 for missing file", async () => {
    (prisma.userFile.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const res = await GET_BY_ID(new Request("http://localhost"), makeParams("nope"));
    expect(res.status).toBe(404);
  });
});

describe("PUT /api/user-files/[id]", () => {
  it("updates file name", async () => {
    const existing = { id: "f1", userId, name: "old.md", content: "data" };
    (prisma.userFile.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(existing);
    (prisma.userFile.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...existing, name: "new.md", createdAt: new Date(), updatedAt: new Date(),
    });

    const req = new Request("http://localhost", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "new.md" }),
    });
    const res = await PUT_BY_ID(req, makeParams("f1"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.name).toBe("new.md");
  });

  it("rejects invalid name", async () => {
    const existing = { id: "f1", userId };
    (prisma.userFile.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(existing);

    const req = new Request("http://localhost", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "" }),
    });
    const res = await PUT_BY_ID(req, makeParams("f1"));
    expect(res.status).toBe(400);
  });

  it("returns 404 for another user's file", async () => {
    (prisma.userFile.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const req = new Request("http://localhost", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "hack.md" }),
    });
    const res = await PUT_BY_ID(req, makeParams("f-other"));
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/user-files/[id]", () => {
  it("deletes owned file", async () => {
    (prisma.userFile.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "f1", userId });
    (prisma.userFile.delete as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const res = await DELETE_BY_ID(new Request("http://localhost"), makeParams("f1"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  it("returns 404 for missing file", async () => {
    (prisma.userFile.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const res = await DELETE_BY_ID(new Request("http://localhost"), makeParams("nope"));
    expect(res.status).toBe(404);
  });
});
