import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  sanitizeFilename,
  exportAsText,
  exportAsHtml,
  exportAsMarkdown,
} from "@/lib/export-utils";
import type { ExportFormat } from "@/lib/export-utils";

// ─── DOM mocks for download ──────────────────────────────

let clickedHref: string | null = null;
let clickedDownload: string | null = null;

beforeEach(() => {
  clickedHref = null;
  clickedDownload = null;

  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock-url");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
    if (tag === "a") {
      return {
        set href(val: string) { clickedHref = val; },
        get href() { return clickedHref || ""; },
        set download(val: string) { clickedDownload = val; },
        get download() { return clickedDownload || ""; },
        click: vi.fn(),
      } as unknown as HTMLAnchorElement;
    }
    return document.createElement(tag);
  });
});

// ─── sanitizeFilename ───────────────────────────────────

describe("sanitizeFilename", () => {
  it("should remove forbidden characters", () => {
    expect(sanitizeFilename('file<>:"/\\|?*.txt')).toBe("file.txt");
  });

  it("should collapse whitespace", () => {
    expect(sanitizeFilename("a   b  c")).toBe("a b c");
  });

  it("should trim whitespace", () => {
    expect(sanitizeFilename("  name  ")).toBe("name");
  });

  it("should truncate to 200 characters", () => {
    const longName = "a".repeat(250);
    expect(sanitizeFilename(longName).length).toBe(200);
  });

  it("should handle empty string", () => {
    expect(sanitizeFilename("")).toBe("");
  });
});

// ─── ExportFormat type check ────────────────────────────

describe("ExportFormat type", () => {
  it("should include all 6 formats", () => {
    const formats: ExportFormat[] = ["docx", "pdf", "txt", "xlsx", "html", "md"];
    expect(formats).toHaveLength(6);
  });
});

// ─── exportAsText ───────────────────────────────────────

describe("exportAsText", () => {
  it("should create a blob and trigger download", () => {
    exportAsText("Hello world", "test-file");
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(clickedDownload).toBe("test-file.txt");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
  });

  it("should use custom extension", () => {
    exportAsText("code", "app", ".py");
    expect(clickedDownload).toBe("app.py");
  });

  it("should sanitize filename", () => {
    exportAsText("data", 'file<>name', ".txt");
    expect(clickedDownload).toBe("filename.txt");
  });
});

// ─── exportAsHtml ───────────────────────────────────────

describe("exportAsHtml", () => {
  it("should trigger download with .html extension", () => {
    exportAsHtml("# Title\n\nParagraph", "document");
    expect(clickedDownload).toBe("document.html");
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it("should create a blob with HTML content type", () => {
    const blobSpy = vi.spyOn(globalThis, "Blob");
    exportAsHtml("Content", "test");
    expect(blobSpy).toHaveBeenCalled();
    const [parts, options] = blobSpy.mock.calls[0];
    expect(options).toEqual({ type: "text/html;charset=utf-8" });
    const content = parts![0] as string;
    expect(content).toContain("<!DOCTYPE html>");
    expect(content).toContain("<title>test</title>");
    blobSpy.mockRestore();
  });

  it("should convert markdown headings to HTML", () => {
    const blobSpy = vi.spyOn(globalThis, "Blob");
    exportAsHtml("# Big Title\n\n## Section\n\n### Sub", "headings");
    const content = (blobSpy.mock.calls[0][0]![0] as string);
    expect(content).toContain("<h1>Big Title</h1>");
    expect(content).toContain("<h2>Section</h2>");
    expect(content).toContain("<h3>Sub</h3>");
    blobSpy.mockRestore();
  });

  it("should convert bold and italic", () => {
    const blobSpy = vi.spyOn(globalThis, "Blob");
    exportAsHtml("**bold** and *italic*", "format");
    const content = (blobSpy.mock.calls[0][0]![0] as string);
    expect(content).toContain("<strong>bold</strong>");
    expect(content).toContain("<em>italic</em>");
    blobSpy.mockRestore();
  });

  it("should include A4 styling", () => {
    const blobSpy = vi.spyOn(globalThis, "Blob");
    exportAsHtml("text", "styled");
    const content = (blobSpy.mock.calls[0][0]![0] as string);
    expect(content).toContain("210mm");
    expect(content).toContain("Times New Roman");
    blobSpy.mockRestore();
  });

  it("should escape title in HTML", () => {
    const blobSpy = vi.spyOn(globalThis, "Blob");
    exportAsHtml("text", "<script>alert(1)</script>");
    const content = (blobSpy.mock.calls[0][0]![0] as string);
    expect(content).toContain("&lt;script&gt;");
    expect(content).not.toContain("<script>");
    blobSpy.mockRestore();
  });

  it("should convert markdown tables to HTML tables", () => {
    const blobSpy = vi.spyOn(globalThis, "Blob");
    const md = "| H1 | H2 |\n| --- | --- |\n| A | B |";
    exportAsHtml(md, "table-doc");
    const content = (blobSpy.mock.calls[0][0]![0] as string);
    expect(content).toContain("<table>");
    expect(content).toContain("<th>H1</th>");
    expect(content).toContain("<td>A</td>");
    blobSpy.mockRestore();
  });

  it("should convert unordered lists", () => {
    const blobSpy = vi.spyOn(globalThis, "Blob");
    exportAsHtml("- Item 1\n- Item 2", "list");
    const content = (blobSpy.mock.calls[0][0]![0] as string);
    expect(content).toContain("<ul>");
    expect(content).toContain("<li>Item 1</li>");
    blobSpy.mockRestore();
  });

  it("should convert ordered lists", () => {
    const blobSpy = vi.spyOn(globalThis, "Blob");
    exportAsHtml("1. First\n2. Second", "ordered");
    const content = (blobSpy.mock.calls[0][0]![0] as string);
    expect(content).toContain("<ol>");
    expect(content).toContain("<li>First</li>");
    blobSpy.mockRestore();
  });

  it("should convert code blocks", () => {
    const blobSpy = vi.spyOn(globalThis, "Blob");
    exportAsHtml("```js\nconsole.log('hi')\n```", "code");
    const content = (blobSpy.mock.calls[0][0]![0] as string);
    expect(content).toContain("<pre><code>");
    blobSpy.mockRestore();
  });

  it("should convert inline code", () => {
    const blobSpy = vi.spyOn(globalThis, "Blob");
    exportAsHtml("Use `npm install` command", "inline-code");
    const content = (blobSpy.mock.calls[0][0]![0] as string);
    expect(content).toContain("<code>npm install</code>");
    blobSpy.mockRestore();
  });

  it("should convert links", () => {
    const blobSpy = vi.spyOn(globalThis, "Blob");
    exportAsHtml("[Google](https://google.com)", "links");
    const content = (blobSpy.mock.calls[0][0]![0] as string);
    expect(content).toContain('<a href="https://google.com">Google</a>');
    blobSpy.mockRestore();
  });

  it("should convert horizontal rules", () => {
    const blobSpy = vi.spyOn(globalThis, "Blob");
    exportAsHtml("Above\n\n---\n\nBelow", "hr");
    const content = (blobSpy.mock.calls[0][0]![0] as string);
    expect(content).toContain("<hr>");
    blobSpy.mockRestore();
  });
});

// ─── exportAsMarkdown ───────────────────────────────────

describe("exportAsMarkdown", () => {
  it("should trigger download with .md extension", () => {
    exportAsMarkdown("# Title\n\nText", "readme");
    expect(clickedDownload).toBe("readme.md");
  });

  it("should preserve raw markdown content", () => {
    const blobSpy = vi.spyOn(globalThis, "Blob");
    const md = "# Heading\n\n**Bold** text\n\n- item";
    exportAsMarkdown(md, "doc");
    const [parts] = blobSpy.mock.calls[0];
    expect(parts![0]).toBe(md);
    blobSpy.mockRestore();
  });
});
