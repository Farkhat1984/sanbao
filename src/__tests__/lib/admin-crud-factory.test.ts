import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { createAdminCrudHandlers } from "@/lib/admin-crud-factory";

// Mock admin auth — default: authenticated admin
const mockRequireAdmin = vi.fn().mockResolvedValue({ userId: "admin-1" });
vi.mock("@/lib/admin", () => ({
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
}));

// Mock prisma — simulate the delegate pattern used by getDelegate()
const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    testModel: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
      delete: (...args: unknown[]) => mockDelete(...args),
    },
  },
}));

// ─── Helpers ───

function makeRequest(url: string, method = "GET", body?: Record<string, unknown>): Request {
  const init: RequestInit = { method };
  if (body) {
    init.body = JSON.stringify(body);
  }
  return new Request(url, init);
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

// ─── Tests ───

describe("createAdminCrudHandlers", () => {
  const baseConfig = {
    model: "testModel",
    allowedUpdateFields: ["name", "status"],
    notFoundMsg: "Not found",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdmin.mockResolvedValue({ userId: "admin-1" });
  });

  // ─── Auth ───

  describe("Auth", () => {
    it("GET returns auth error when requireAdmin fails", async () => {
      const authError = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      mockRequireAdmin.mockResolvedValue({ error: authError });

      const { GET } = createAdminCrudHandlers(baseConfig);
      const response = await GET(makeRequest("http://localhost/api/admin/test/1"), makeParams("1"));

      expect(response.status).toBe(401);
      expect(mockFindUnique).not.toHaveBeenCalled();
    });

    it("PUT returns auth error when requireAdmin fails", async () => {
      const authError = NextResponse.json({ error: "Forbidden" }, { status: 403 });
      mockRequireAdmin.mockResolvedValue({ error: authError });

      const { PUT } = createAdminCrudHandlers(baseConfig);
      const response = await PUT(
        makeRequest("http://localhost/api/admin/test/1", "PUT", { name: "x" }),
        makeParams("1"),
      );

      expect(response.status).toBe(403);
      expect(mockFindUnique).not.toHaveBeenCalled();
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("DELETE returns auth error when requireAdmin fails", async () => {
      const authError = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      mockRequireAdmin.mockResolvedValue({ error: authError });

      const { DELETE } = createAdminCrudHandlers(baseConfig);
      const response = await DELETE(
        makeRequest("http://localhost/api/admin/test/1", "DELETE"),
        makeParams("1"),
      );

      expect(response.status).toBe(401);
      expect(mockFindUnique).not.toHaveBeenCalled();
      expect(mockDelete).not.toHaveBeenCalled();
    });
  });

  // ─── GET ───

  describe("GET", () => {
    it("returns record when found", async () => {
      const record = { id: "1", name: "Test", status: "active" };
      mockFindUnique.mockResolvedValue(record);

      const { GET } = createAdminCrudHandlers(baseConfig);
      const response = await GET(makeRequest("http://localhost/api/admin/test/1"), makeParams("1"));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual(record);
    });

    it("returns 404 when not found", async () => {
      mockFindUnique.mockResolvedValue(null);

      const { GET } = createAdminCrudHandlers(baseConfig);
      const response = await GET(makeRequest("http://localhost/api/admin/test/999"), makeParams("999"));

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error).toBe("Not found");
    });

    it("applies include option to prisma query", async () => {
      mockFindUnique.mockResolvedValue({ id: "1", _count: { items: 5 } });

      const { GET } = createAdminCrudHandlers({
        ...baseConfig,
        include: { _count: { select: { items: true } } },
      });
      await GET(makeRequest("http://localhost/api/admin/test/1"), makeParams("1"));

      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { id: "1" },
        include: { _count: { select: { items: true } } },
      });
    });

    it("applies transformGet to the returned record", async () => {
      mockFindUnique.mockResolvedValue({ id: "1", secret: "s3cr3t", name: "Test" });

      const { GET } = createAdminCrudHandlers({
        ...baseConfig,
        transformGet: (r) => ({ id: r.id, name: r.name, secret: "***" }),
      });
      const response = await GET(makeRequest("http://localhost/api/admin/test/1"), makeParams("1"));

      const body = await response.json();
      expect(body.secret).toBe("***");
      expect(body.name).toBe("Test");
    });

    it("applies findWhere to the query conditions", async () => {
      mockFindUnique.mockResolvedValue(null);

      const { GET } = createAdminCrudHandlers({
        ...baseConfig,
        findWhere: { isGlobal: true },
      });
      await GET(makeRequest("http://localhost/api/admin/test/1"), makeParams("1"));

      expect(mockFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "1", isGlobal: true },
        }),
      );
    });
  });

  // ─── PUT ───

  describe("PUT", () => {
    it("updates only allowedUpdateFields (whitelist)", async () => {
      mockFindUnique.mockResolvedValue({ id: "1" });
      mockUpdate.mockResolvedValue({ id: "1", name: "Updated", status: "inactive" });

      const { PUT } = createAdminCrudHandlers(baseConfig);
      const response = await PUT(
        makeRequest("http://localhost/api/admin/test/1", "PUT", {
          name: "Updated",
          status: "inactive",
        }),
        makeParams("1"),
      );

      expect(response.status).toBe(200);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { name: "Updated", status: "inactive" },
        }),
      );
    });

    it("ignores fields not in allowedUpdateFields (mass assignment protection)", async () => {
      mockFindUnique.mockResolvedValue({ id: "1" });
      mockUpdate.mockResolvedValue({ id: "1", name: "Updated" });

      const { PUT } = createAdminCrudHandlers(baseConfig);
      await PUT(
        makeRequest("http://localhost/api/admin/test/1", "PUT", {
          name: "Updated",
          role: "ADMIN",
          isDeleted: true,
          secretKey: "hack",
        }),
        makeParams("1"),
      );

      // Only "name" should be in data — role, isDeleted, secretKey are not in allowedUpdateFields
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { name: "Updated" },
        }),
      );
    });

    it("returns 404 when record not found", async () => {
      mockFindUnique.mockResolvedValue(null);

      const { PUT } = createAdminCrudHandlers(baseConfig);
      const response = await PUT(
        makeRequest("http://localhost/api/admin/test/999", "PUT", { name: "x" }),
        makeParams("999"),
      );

      expect(response.status).toBe(404);
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("calls beforeUpdate hook with body and existing record", async () => {
      const existing = { id: "1", name: "Old" };
      mockFindUnique.mockResolvedValue(existing);
      mockUpdate.mockResolvedValue({ id: "1", name: "New" });
      const beforeUpdate = vi.fn();

      const { PUT } = createAdminCrudHandlers({
        ...baseConfig,
        beforeUpdate,
      });

      const body = { name: "New" };
      await PUT(
        makeRequest("http://localhost/api/admin/test/1", "PUT", body),
        makeParams("1"),
      );

      expect(beforeUpdate).toHaveBeenCalledOnce();
      expect(beforeUpdate).toHaveBeenCalledWith(body, existing);
      expect(mockUpdate).toHaveBeenCalled();
    });

    it("beforeUpdate can abort with NextResponse", async () => {
      mockFindUnique.mockResolvedValue({ id: "1" });

      const { PUT } = createAdminCrudHandlers({
        ...baseConfig,
        beforeUpdate: () => {
          return NextResponse.json({ error: "Validation failed" }, { status: 400 });
        },
      });

      const response = await PUT(
        makeRequest("http://localhost/api/admin/test/1", "PUT", { name: "Test" }),
        makeParams("1"),
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe("Validation failed");
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("calls afterUpdate callback after successful update", async () => {
      mockFindUnique.mockResolvedValue({ id: "1" });
      mockUpdate.mockResolvedValue({ id: "1" });
      const afterUpdate = vi.fn();

      const { PUT } = createAdminCrudHandlers({
        ...baseConfig,
        afterUpdate,
      });

      await PUT(
        makeRequest("http://localhost/api/admin/test/1", "PUT", { name: "Test" }),
        makeParams("1"),
      );

      expect(afterUpdate).toHaveBeenCalledOnce();
    });

    it("applies transformField to each field value before saving", async () => {
      mockFindUnique.mockResolvedValue({ id: "1" });
      mockUpdate.mockResolvedValue({ id: "1", name: "UPPER", status: "ACTIVE" });

      const { PUT } = createAdminCrudHandlers({
        ...baseConfig,
        transformField: (field, value) => {
          if (field === "name") return (value as string).toUpperCase();
          if (field === "status") return (value as string).toUpperCase();
          return value;
        },
      });

      await PUT(
        makeRequest("http://localhost/api/admin/test/1", "PUT", { name: "lower", status: "active" }),
        makeParams("1"),
      );

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { name: "LOWER", status: "ACTIVE" },
        }),
      );
    });

    it("applies transformPut to the response record", async () => {
      mockFindUnique.mockResolvedValue({ id: "1" });
      mockUpdate.mockResolvedValue({ id: "1", name: "Test", internalField: "secret" });

      const { PUT } = createAdminCrudHandlers({
        ...baseConfig,
        transformPut: (r) => ({ id: r.id, name: r.name }),
      });

      const response = await PUT(
        makeRequest("http://localhost/api/admin/test/1", "PUT", { name: "Test" }),
        makeParams("1"),
      );

      const body = await response.json();
      expect(body).toEqual({ id: "1", name: "Test" });
      expect(body.internalField).toBeUndefined();
    });

    it("applies includeOnPut to the update query", async () => {
      mockFindUnique.mockResolvedValue({ id: "1" });
      mockUpdate.mockResolvedValue({ id: "1", name: "Test", items: [] });

      const { PUT } = createAdminCrudHandlers({
        ...baseConfig,
        includeOnPut: { items: true },
      });

      await PUT(
        makeRequest("http://localhost/api/admin/test/1", "PUT", { name: "Test" }),
        makeParams("1"),
      );

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          include: { items: true },
        }),
      );
    });

    it("uses findWhere when checking existence but updates by id only", async () => {
      mockFindUnique.mockResolvedValue({ id: "1" });
      mockUpdate.mockResolvedValue({ id: "1", name: "Updated" });

      const { PUT } = createAdminCrudHandlers({
        ...baseConfig,
        findWhere: { isGlobal: true },
      });

      await PUT(
        makeRequest("http://localhost/api/admin/test/1", "PUT", { name: "Updated" }),
        makeParams("1"),
      );

      // findUnique uses findWhere
      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { id: "1", isGlobal: true },
      });
      // update uses only id
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "1" },
        }),
      );
    });

    it("skips undefined fields from body", async () => {
      mockFindUnique.mockResolvedValue({ id: "1" });
      mockUpdate.mockResolvedValue({ id: "1", name: "Only" });

      const { PUT } = createAdminCrudHandlers(baseConfig);
      // Send only "name", not "status" — status should not appear in data
      await PUT(
        makeRequest("http://localhost/api/admin/test/1", "PUT", { name: "Only" }),
        makeParams("1"),
      );

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { name: "Only" },
        }),
      );
    });
  });

  // ─── DELETE ───

  describe("DELETE", () => {
    it("deletes record and returns success", async () => {
      mockFindUnique.mockResolvedValue({ id: "1" });
      mockDelete.mockResolvedValue({ id: "1" });

      const { DELETE } = createAdminCrudHandlers(baseConfig);
      const response = await DELETE(
        makeRequest("http://localhost/api/admin/test/1", "DELETE"),
        makeParams("1"),
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
    });

    it("returns 404 when not found", async () => {
      mockFindUnique.mockResolvedValue(null);

      const { DELETE } = createAdminCrudHandlers(baseConfig);
      const response = await DELETE(
        makeRequest("http://localhost/api/admin/test/999", "DELETE"),
        makeParams("999"),
      );

      expect(response.status).toBe(404);
      expect(mockDelete).not.toHaveBeenCalled();
    });

    it("calls beforeDelete with the existing record", async () => {
      const existing = { id: "1", name: "ToDelete" };
      mockFindUnique.mockResolvedValue(existing);
      mockDelete.mockResolvedValue(existing);
      const beforeDelete = vi.fn();

      const { DELETE } = createAdminCrudHandlers({
        ...baseConfig,
        beforeDelete,
      });

      await DELETE(
        makeRequest("http://localhost/api/admin/test/1", "DELETE"),
        makeParams("1"),
      );

      expect(beforeDelete).toHaveBeenCalledOnce();
      expect(beforeDelete).toHaveBeenCalledWith(existing);
      expect(mockDelete).toHaveBeenCalled();
    });

    it("beforeDelete can abort with NextResponse", async () => {
      mockFindUnique.mockResolvedValue({ id: "1" });

      const { DELETE } = createAdminCrudHandlers({
        ...baseConfig,
        beforeDelete: () => {
          return NextResponse.json({ error: "Cannot delete" }, { status: 403 });
        },
      });

      const response = await DELETE(
        makeRequest("http://localhost/api/admin/test/1", "DELETE"),
        makeParams("1"),
      );

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toBe("Cannot delete");
      expect(mockDelete).not.toHaveBeenCalled();
    });

    it("calls afterDelete callback after successful deletion", async () => {
      mockFindUnique.mockResolvedValue({ id: "1" });
      mockDelete.mockResolvedValue({ id: "1" });
      const afterDelete = vi.fn();

      const { DELETE } = createAdminCrudHandlers({
        ...baseConfig,
        afterDelete,
      });

      await DELETE(
        makeRequest("http://localhost/api/admin/test/1", "DELETE"),
        makeParams("1"),
      );

      expect(afterDelete).toHaveBeenCalledOnce();
    });

    it("uses findWhere when checking existence but deletes by id only", async () => {
      mockFindUnique.mockResolvedValue({ id: "1" });
      mockDelete.mockResolvedValue({ id: "1" });

      const { DELETE } = createAdminCrudHandlers({
        ...baseConfig,
        findWhere: { isGlobal: true },
      });

      await DELETE(
        makeRequest("http://localhost/api/admin/test/1", "DELETE"),
        makeParams("1"),
      );

      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { id: "1", isGlobal: true },
      });
      expect(mockDelete).toHaveBeenCalledWith({
        where: { id: "1" },
      });
    });
  });
});
