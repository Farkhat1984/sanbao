import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const authMock = auth as any;
import { prisma } from "@/lib/prisma";

import { POST, DELETE } from "@/app/api/agents/[id]/files/route";

// Mock parse-file
vi.mock("@/lib/parse-file", () => ({
  parseFileToText: vi.fn().mockResolvedValue("Extracted text"),
}));

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function makeUploadRequest(agentId: string, fileName: string, type: string, size?: number) {
  const blob = new Blob(["file content"], { type });
  const file = new File([blob], fileName, { type });
  if (size) {
    Object.defineProperty(file, "size", { value: size });
  }
  const formData = new FormData();
  formData.append("file", file);
  return new Request(`http://localhost/api/agents/${agentId}/files`, {
    method: "POST",
    body: formData,
  });
}

function makeDeleteRequest(agentId: string, fileId: string) {
  return new Request(`http://localhost/api/agents/${agentId}/files`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileId }),
  });
}

describe("Agent Files API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authMock).mockResolvedValue({
      user: { id: "user-1", email: "test@test.com", role: "USER" },
      expires: "",
    });
  });

  // ═══ POST /api/agents/[id]/files ══════════════════════

  describe("POST /api/agents/[id]/files (upload)", () => {
    it("should return 401 if not authenticated", async () => {
      vi.mocked(authMock).mockResolvedValueOnce(null);
      const req = makeUploadRequest("agent-1", "doc.pdf", "application/pdf");
      const res = await POST(req, makeParams("agent-1"));
      expect(res.status).toBe(401);
    });

    it("should return 404 if agent not found", async () => {
      vi.mocked(prisma.agent.findFirst).mockResolvedValueOnce(null);
      const req = makeUploadRequest("agent-x", "doc.pdf", "application/pdf");
      const res = await POST(req, makeParams("agent-x"));
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toContain("Агент");
    });

    it("should return 400 if no file provided", async () => {
      vi.mocked(prisma.agent.findFirst).mockResolvedValueOnce({ id: "agent-1" } as never);
      const formData = new FormData();
      const req = new Request("http://localhost/api/agents/agent-1/files", {
        method: "POST",
        body: formData,
      });
      const res = await POST(req, makeParams("agent-1"));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("Файл не найден");
    });

    it("should return 400 if file exceeds 10MB", async () => {
      vi.mocked(prisma.agent.findFirst).mockResolvedValueOnce({ id: "agent-1" } as never);
      const fakeFile = {
        name: "big.pdf",
        type: "application/pdf",
        size: 15 * 1024 * 1024,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(1)),
      };
      const req = makeUploadRequest("agent-1", "big.pdf", "application/pdf");
      req.formData = async () => {
        const fd = new FormData();
        fd.get = (key: string) => key === "file" ? fakeFile as unknown as FormDataEntryValue : null;
        return fd;
      };
      const res = await POST(req, makeParams("agent-1"));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("10MB");
    });

    it("should return 400 for unsupported file type", async () => {
      vi.mocked(prisma.agent.findFirst).mockResolvedValueOnce({ id: "agent-1" } as never);
      const req = makeUploadRequest("agent-1", "virus.exe", "application/x-executable");
      const res = await POST(req, makeParams("agent-1"));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("Неподдерживаемый");
    });

    it("should return 413 when storage quota exceeded", async () => {
      vi.mocked(prisma.agent.findFirst).mockResolvedValueOnce({ id: "agent-1" } as never);
      vi.mocked(prisma.subscription.findUnique).mockResolvedValueOnce({
        plan: { maxStorageMb: 1 },
      } as never);
      vi.mocked(prisma.agentFile.aggregate).mockResolvedValueOnce({
        _sum: { fileSize: 1024 * 1024 }, // 1MB used
      } as never);

      const req = makeUploadRequest("agent-1", "doc.pdf", "application/pdf", 512 * 1024);
      const res = await POST(req, makeParams("agent-1"));
      expect(res.status).toBe(413);
      const body = await res.json();
      expect(body.error).toContain("квота");
    });

    it("should upload PDF successfully", async () => {
      vi.mocked(prisma.agent.findFirst).mockResolvedValueOnce({ id: "agent-1" } as never);
      vi.mocked(prisma.agentFile.create).mockResolvedValueOnce({
        id: "file-1",
        agentId: "agent-1",
        fileName: "doc.pdf",
        fileType: "application/pdf",
        fileUrl: "/uploads/agents/agent-1/123-doc.pdf",
        fileSize: 100,
        extractedText: "Extracted text",
        createdAt: new Date("2025-01-01"),
      } as never);

      const req = makeUploadRequest("agent-1", "doc.pdf", "application/pdf");
      const res = await POST(req, makeParams("agent-1"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.fileName).toBe("doc.pdf");
      expect(body.extractedText).toBe("Extracted text");
    });

    it("should upload DOCX successfully", async () => {
      vi.mocked(prisma.agent.findFirst).mockResolvedValueOnce({ id: "agent-1" } as never);
      vi.mocked(prisma.agentFile.create).mockResolvedValueOnce({
        id: "file-2",
        agentId: "agent-1",
        fileName: "report.docx",
        fileType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        fileUrl: "/uploads/agents/agent-1/123-report.docx",
        fileSize: 200,
        extractedText: "Extracted text",
        createdAt: new Date(),
      } as never);

      const req = makeUploadRequest(
        "agent-1",
        "report.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      );
      const res = await POST(req, makeParams("agent-1"));
      expect(res.status).toBe(200);
    });

    it("should upload CSV successfully", async () => {
      vi.mocked(prisma.agent.findFirst).mockResolvedValueOnce({ id: "agent-1" } as never);
      vi.mocked(prisma.agentFile.create).mockResolvedValueOnce({
        id: "file-3",
        fileName: "data.csv",
        fileType: "text/csv",
        fileUrl: "/uploads/agents/agent-1/123-data.csv",
        fileSize: 50,
        extractedText: "Extracted text",
        createdAt: new Date(),
      } as never);

      const req = makeUploadRequest("agent-1", "data.csv", "text/csv");
      const res = await POST(req, makeParams("agent-1"));
      expect(res.status).toBe(200);
    });

    it("should upload HTML successfully", async () => {
      vi.mocked(prisma.agent.findFirst).mockResolvedValueOnce({ id: "agent-1" } as never);
      vi.mocked(prisma.agentFile.create).mockResolvedValueOnce({
        id: "file-4",
        fileName: "page.html",
        fileType: "text/html",
        fileUrl: "/uploads/agents/agent-1/123-page.html",
        fileSize: 150,
        extractedText: "Extracted text",
        createdAt: new Date(),
      } as never);

      const req = makeUploadRequest("agent-1", "page.html", "text/html");
      const res = await POST(req, makeParams("agent-1"));
      expect(res.status).toBe(200);
    });

    it("should upload PPTX successfully", async () => {
      vi.mocked(prisma.agent.findFirst).mockResolvedValueOnce({ id: "agent-1" } as never);
      vi.mocked(prisma.agentFile.create).mockResolvedValueOnce({
        id: "file-5",
        fileName: "slides.pptx",
        fileType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        fileUrl: "/uploads/agents/agent-1/123-slides.pptx",
        fileSize: 300,
        extractedText: "Extracted text",
        createdAt: new Date(),
      } as never);

      const req = makeUploadRequest(
        "agent-1",
        "slides.pptx",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation"
      );
      const res = await POST(req, makeParams("agent-1"));
      expect(res.status).toBe(200);
    });

    it("should upload RTF successfully", async () => {
      vi.mocked(prisma.agent.findFirst).mockResolvedValueOnce({ id: "agent-1" } as never);
      vi.mocked(prisma.agentFile.create).mockResolvedValueOnce({
        id: "file-6",
        fileName: "letter.rtf",
        fileType: "application/rtf",
        fileUrl: "/uploads/agents/agent-1/123-letter.rtf",
        fileSize: 80,
        extractedText: "Extracted text",
        createdAt: new Date(),
      } as never);

      const req = makeUploadRequest("agent-1", "letter.rtf", "application/rtf");
      const res = await POST(req, makeParams("agent-1"));
      expect(res.status).toBe(200);
    });

    it("should skip text extraction for images", async () => {
      vi.mocked(prisma.agent.findFirst).mockResolvedValueOnce({ id: "agent-1" } as never);
      vi.mocked(prisma.agentFile.create).mockResolvedValueOnce({
        id: "file-img",
        fileName: "photo.png",
        fileType: "image/png",
        fileUrl: "/uploads/agents/agent-1/123-photo.png",
        fileSize: 500,
        extractedText: null,
        createdAt: new Date(),
      } as never);

      const req = makeUploadRequest("agent-1", "photo.png", "image/png");
      const res = await POST(req, makeParams("agent-1"));
      expect(res.status).toBe(200);
      // Verify extractedText is null for images
      const createCall = vi.mocked(prisma.agentFile.create).mock.calls[0][0];
      expect(createCall.data.extractedText).toBeNull();
    });
  });

  // ═══ DELETE /api/agents/[id]/files ════════════════════

  describe("DELETE /api/agents/[id]/files", () => {
    it("should return 401 if not authenticated", async () => {
      vi.mocked(authMock).mockResolvedValueOnce(null);
      const req = makeDeleteRequest("agent-1", "file-1");
      const res = await DELETE(req, makeParams("agent-1"));
      expect(res.status).toBe(401);
    });

    it("should return 404 if agent not found", async () => {
      vi.mocked(prisma.agent.findFirst).mockResolvedValueOnce(null);
      const req = makeDeleteRequest("agent-x", "file-1");
      const res = await DELETE(req, makeParams("agent-x"));
      expect(res.status).toBe(404);
    });

    it("should return 404 if file not found", async () => {
      vi.mocked(prisma.agent.findFirst).mockResolvedValueOnce({ id: "agent-1" } as never);
      vi.mocked(prisma.agentFile.findFirst).mockResolvedValueOnce(null);
      const req = makeDeleteRequest("agent-1", "nonexistent");
      const res = await DELETE(req, makeParams("agent-1"));
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toContain("Файл не найден");
    });

    it("should delete file successfully", async () => {
      vi.mocked(prisma.agent.findFirst).mockResolvedValueOnce({ id: "agent-1" } as never);
      vi.mocked(prisma.agentFile.findFirst).mockResolvedValueOnce({
        id: "file-1",
        fileUrl: "/uploads/agents/agent-1/123-doc.pdf",
      } as never);
      vi.mocked(prisma.agentFile.delete).mockResolvedValueOnce({} as never);

      const req = makeDeleteRequest("agent-1", "file-1");
      const res = await DELETE(req, makeParams("agent-1"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(prisma.agentFile.delete).toHaveBeenCalledWith({
        where: { id: "file-1" },
      });
    });

    it("should handle missing file on disk gracefully", async () => {
      vi.mocked(prisma.agent.findFirst).mockResolvedValueOnce({ id: "agent-1" } as never);
      vi.mocked(prisma.agentFile.findFirst).mockResolvedValueOnce({
        id: "file-1",
        fileUrl: "/uploads/agents/agent-1/missing-file.pdf",
      } as never);
      vi.mocked(prisma.agentFile.delete).mockResolvedValueOnce({} as never);

      const { unlink } = await import("fs/promises");
      vi.mocked(unlink).mockRejectedValueOnce(new Error("ENOENT"));

      const req = makeDeleteRequest("agent-1", "file-1");
      const res = await DELETE(req, makeParams("agent-1"));
      // Should still succeed even if file missing on disk
      expect(res.status).toBe(200);
      expect(prisma.agentFile.delete).toHaveBeenCalled();
    });
  });
});
