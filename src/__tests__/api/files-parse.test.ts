import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const authMock = auth as any;
import { POST } from "@/app/api/files/parse/route";

// Mock parse-file separately so we can control per-test
vi.mock("@/lib/parse-file", () => ({
  parseFileToText: vi.fn().mockResolvedValue("Parsed text content"),
}));

import { parseFileToText } from "@/lib/parse-file";

// jsdom FormData loses File metadata through Request serialization,
// so we create requests with a custom formData mock
function makeRequest(file: File | null) {
  const formData = new FormData();
  if (file) {
    formData.append("file", file);
  }

  // Build Request with the real formData method returning our controlled FormData
  const req = new Request("http://localhost/api/files/parse", {
    method: "POST",
    // The body must be provided but we override formData()
    body: formData,
  });

  // Override formData() to return our FormData with proper File
  const originalFormData = req.formData.bind(req);
  req.formData = async () => {
    if (file) {
      const fd = new FormData();
      // Re-append the original file to preserve name/type/size
      fd.append("file", file, file.name);
      return fd;
    }
    return originalFormData();
  };

  return req;
}

describe("POST /api/files/parse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authMock).mockResolvedValue({
      user: { id: "test-user-1", email: "test@test.com", role: "USER" },
      expires: "",
    });
  });

  // ─── Auth ─────────────────────────────────────────────

  it("should return 401 if not authenticated", async () => {
    vi.mocked(authMock).mockResolvedValueOnce(null);
    const file = new File(["hello"], "test.txt", { type: "text/plain" });
    const res = await POST(makeRequest(file));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("should return 401 if session has no user id", async () => {
    vi.mocked(authMock).mockResolvedValueOnce({
      user: {},
      expires: "",
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never);
    const file = new File(["hello"], "test.txt", { type: "text/plain" });
    const res = await POST(makeRequest(file));
    expect(res.status).toBe(401);
  });

  // ─── Validation ───────────────────────────────────────

  it("should return 400 if no file provided", async () => {
    const res = await POST(makeRequest(null));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Файл не найден");
  });

  it("should return 400 if file exceeds 20MB", async () => {
    // jsdom File.size is a Blob prototype getter and can't be overridden.
    // Create a mock File-like object with spoofed size.
    const fakeFile = {
      name: "big.pdf",
      type: "application/pdf",
      size: 25 * 1024 * 1024,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(1)),
    };
    const file = new File(["x"], "big.pdf", { type: "application/pdf" });
    const req = makeRequest(file);
    req.formData = async () => {
      const fd = new FormData();
      fd.get = (key: string) => key === "file" ? fakeFile as unknown as FormDataEntryValue : null;
      return fd;
    };
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("20MB");
  });

  // ─── Success cases for each format ────────────────────

  it("should parse PDF successfully", async () => {
    const file = new File(["fake-pdf"], "document.pdf", { type: "application/pdf" });
    const res = await POST(makeRequest(file));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.text).toBe("Parsed text content");
    expect(body.fileName).toBe("document.pdf");
    expect(parseFileToText).toHaveBeenCalled();
  });

  it("should parse DOCX successfully", async () => {
    const file = new File(["fake-docx"], "report.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    const res = await POST(makeRequest(file));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.text).toBe("Parsed text content");
    expect(body.fileName).toBe("report.docx");
  });

  it("should parse XLSX successfully", async () => {
    const file = new File(["fake-xlsx"], "data.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const res = await POST(makeRequest(file));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.text).toBe("Parsed text content");
  });

  it("should parse CSV successfully", async () => {
    const file = new File(["a,b\n1,2"], "data.csv", { type: "text/csv" });
    const res = await POST(makeRequest(file));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.text).toBe("Parsed text content");
    expect(body.fileName).toBe("data.csv");
  });

  it("should parse HTML successfully", async () => {
    const file = new File(["<p>Hello</p>"], "page.html", { type: "text/html" });
    const res = await POST(makeRequest(file));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.text).toBe("Parsed text content");
  });

  it("should parse PPTX successfully", async () => {
    const file = new File(["fake-pptx"], "slides.pptx", {
      type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    });
    const res = await POST(makeRequest(file));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.text).toBe("Parsed text content");
  });

  it("should parse RTF successfully", async () => {
    const file = new File(["fake-rtf"], "letter.rtf", { type: "application/rtf" });
    const res = await POST(makeRequest(file));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.text).toBe("Parsed text content");
  });

  it("should parse TXT successfully", async () => {
    const file = new File(["Plain text"], "notes.txt", { type: "text/plain" });
    const res = await POST(makeRequest(file));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.text).toBe("Parsed text content");
  });

  // ─── Error handling ───────────────────────────────────

  it("should return 422 when parsed text is empty", async () => {
    vi.mocked(parseFileToText).mockResolvedValueOnce("");
    const file = new File(["fake"], "empty.pdf", { type: "application/pdf" });
    const res = await POST(makeRequest(file));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toContain("извлечь текст");
  });

  it("should return 500 when parser throws", async () => {
    vi.mocked(parseFileToText).mockRejectedValueOnce(new Error("Parse failed"));
    const file = new File(["bad"], "broken.pdf", { type: "application/pdf" });
    const res = await POST(makeRequest(file));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Parse failed");
  });

  it("should return generic error for non-Error throws", async () => {
    vi.mocked(parseFileToText).mockRejectedValueOnce("unknown error");
    const file = new File(["bad"], "broken.txt", { type: "text/plain" });
    const res = await POST(makeRequest(file));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Ошибка обработки файла");
  });
});
