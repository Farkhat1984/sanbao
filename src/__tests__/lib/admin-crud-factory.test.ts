import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { createAdminCrudHandlers } from "@/lib/admin-crud-factory";

// Mock admin auth
vi.mock("@/lib/admin", () => ({
  requireAdmin: vi.fn().mockResolvedValue({ userId: "admin-1" }),
}));

// Mock prisma — we need to simulate the delegate pattern
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

describe("createAdminCrudHandlers", () => {
  const baseConfig = {
    model: "testModel",
    allowedUpdateFields: ["name", "status"],
    notFoundMsg: "Not found",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET", () => {
    it("returns record when found", async () => {
      const record = { id: "1", name: "Test", status: "active" };
      mockFindUnique.mockResolvedValue(record);

      const { GET } = createAdminCrudHandlers(baseConfig);
      const req = new Request("http://localhost/api/admin/test/1");
      const response = await GET(req, { params: Promise.resolve({ id: "1" }) });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.name).toBe("Test");
    });

    it("returns 404 when not found", async () => {
      mockFindUnique.mockResolvedValue(null);

      const { GET } = createAdminCrudHandlers(baseConfig);
      const req = new Request("http://localhost/api/admin/test/999");
      const response = await GET(req, { params: Promise.resolve({ id: "999" }) });

      expect(response.status).toBe(404);
    });

    it("applies transformGet", async () => {
      mockFindUnique.mockResolvedValue({ id: "1", secret: "s3cr3t" });

      const { GET } = createAdminCrudHandlers({
        ...baseConfig,
        transformGet: (r) => ({ ...r, secret: "***" }),
      });
      const req = new Request("http://localhost/api/admin/test/1");
      const response = await GET(req, { params: Promise.resolve({ id: "1" }) });

      const body = await response.json();
      expect(body.secret).toBe("***");
    });

    it("uses findWhere in query", async () => {
      mockFindUnique.mockResolvedValue(null);

      const { GET } = createAdminCrudHandlers({
        ...baseConfig,
        findWhere: { isGlobal: true },
      });
      const req = new Request("http://localhost/api/admin/test/1");
      await GET(req, { params: Promise.resolve({ id: "1" }) });

      expect(mockFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "1", isGlobal: true },
        })
      );
    });
  });

  describe("PUT", () => {
    it("updates only allowed fields", async () => {
      mockFindUnique.mockResolvedValue({ id: "1" });
      mockUpdate.mockResolvedValue({ id: "1", name: "Updated" });

      const { PUT } = createAdminCrudHandlers(baseConfig);
      const req = new Request("http://localhost/api/admin/test/1", {
        method: "PUT",
        body: JSON.stringify({ name: "Updated", secret: "hack", status: "inactive" }),
      });
      const response = await PUT(req, { params: Promise.resolve({ id: "1" }) });

      expect(response.status).toBe(200);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { name: "Updated", status: "inactive" },
        })
      );
    });

    it("calls beforeUpdate and aborts on error response", async () => {
      mockFindUnique.mockResolvedValue({ id: "1" });

      const { PUT } = createAdminCrudHandlers({
        ...baseConfig,
        beforeUpdate: () => {
          return NextResponse.json({ error: "Validation failed" }, { status: 400 });
        },
      });

      const req = new Request("http://localhost/api/admin/test/1", {
        method: "PUT",
        body: JSON.stringify({ name: "Test" }),
      });
      const response = await PUT(req, { params: Promise.resolve({ id: "1" }) });

      expect(response.status).toBe(400);
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("applies transformField", async () => {
      mockFindUnique.mockResolvedValue({ id: "1" });
      mockUpdate.mockResolvedValue({ id: "1", name: "UPPER" });

      const { PUT } = createAdminCrudHandlers({
        ...baseConfig,
        transformField: (field, value) => {
          if (field === "name") return (value as string).toUpperCase();
          return value;
        },
      });

      const req = new Request("http://localhost/api/admin/test/1", {
        method: "PUT",
        body: JSON.stringify({ name: "lower" }),
      });
      await PUT(req, { params: Promise.resolve({ id: "1" }) });

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { name: "LOWER" },
        })
      );
    });

    it("calls afterUpdate callback", async () => {
      mockFindUnique.mockResolvedValue({ id: "1" });
      mockUpdate.mockResolvedValue({ id: "1" });
      const afterUpdate = vi.fn();

      const { PUT } = createAdminCrudHandlers({
        ...baseConfig,
        afterUpdate,
      });

      const req = new Request("http://localhost/api/admin/test/1", {
        method: "PUT",
        body: JSON.stringify({ name: "Test" }),
      });
      await PUT(req, { params: Promise.resolve({ id: "1" }) });

      expect(afterUpdate).toHaveBeenCalledOnce();
    });
  });

  describe("DELETE", () => {
    it("deletes record and returns success", async () => {
      mockFindUnique.mockResolvedValue({ id: "1" });
      mockDelete.mockResolvedValue({ id: "1" });

      const { DELETE } = createAdminCrudHandlers(baseConfig);
      const req = new Request("http://localhost/api/admin/test/1", { method: "DELETE" });
      const response = await DELETE(req, { params: Promise.resolve({ id: "1" }) });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
    });

    it("returns 404 when record not found", async () => {
      mockFindUnique.mockResolvedValue(null);

      const { DELETE } = createAdminCrudHandlers(baseConfig);
      const req = new Request("http://localhost/api/admin/test/999", { method: "DELETE" });
      const response = await DELETE(req, { params: Promise.resolve({ id: "999" }) });

      expect(response.status).toBe(404);
    });

    it("calls beforeDelete and aborts on error", async () => {
      mockFindUnique.mockResolvedValue({ id: "1" });

      const { DELETE } = createAdminCrudHandlers({
        ...baseConfig,
        beforeDelete: () => {
          return NextResponse.json({ error: "Cannot delete" }, { status: 403 });
        },
      });

      const req = new Request("http://localhost/api/admin/test/1", { method: "DELETE" });
      const response = await DELETE(req, { params: Promise.resolve({ id: "1" }) });

      expect(response.status).toBe(403);
      expect(mockDelete).not.toHaveBeenCalled();
    });

    it("calls afterDelete callback", async () => {
      mockFindUnique.mockResolvedValue({ id: "1" });
      mockDelete.mockResolvedValue({ id: "1" });
      const afterDelete = vi.fn();

      const { DELETE } = createAdminCrudHandlers({
        ...baseConfig,
        afterDelete,
      });

      const req = new Request("http://localhost/api/admin/test/1", { method: "DELETE" });
      await DELETE(req, { params: Promise.resolve({ id: "1" }) });

      expect(afterDelete).toHaveBeenCalledOnce();
    });
  });
});
