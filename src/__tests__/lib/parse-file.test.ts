import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock heavy native dependencies before importing the module
vi.mock("pdf-parse", () => ({
  PDFParse: vi.fn().mockImplementation(function () {
    return {
      getText: vi.fn().mockResolvedValue({ text: "PDF parsed text content" }),
      destroy: vi.fn().mockResolvedValue(undefined),
    };
  }),
}));

vi.mock("mammoth", () => ({
  default: {
    extractRawText: vi.fn().mockResolvedValue({ value: "Word document text content" }),
  },
}));

vi.mock("xlsx", () => {
  const sheet_to_csv = vi.fn().mockReturnValue("Col1,Col2\nA,B\nC,D");
  return {
    read: vi.fn().mockReturnValue({
      SheetNames: ["Sheet1"],
      Sheets: { Sheet1: {} },
    }),
    utils: { sheet_to_csv },
  };
});

vi.mock("officeparser", () => ({
  parseOffice: vi.fn().mockResolvedValue({
    toText: () => "Extracted text from office document",
  }),
}));

import { parseFileToText } from "@/lib/parse-file";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import { parseOffice } from "officeparser";

describe("parseFileToText", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── PDF ──────────────────────────────────────────────────

  describe("PDF (.pdf)", () => {
    it("should parse PDF by MIME type", async () => {
      const buffer = Buffer.from("fake-pdf");
      const result = await parseFileToText(buffer, "test.pdf", "application/pdf");
      expect(result).toBe("PDF parsed text content");
      expect(PDFParse).toHaveBeenCalled();
    });

    it("should parse PDF by extension", async () => {
      const buffer = Buffer.from("fake-pdf");
      const result = await parseFileToText(buffer, "document.pdf", "");
      expect(result).toBe("PDF parsed text content");
    });

    it("should call destroy after parsing", async () => {
      const buffer = Buffer.from("fake-pdf");
      await parseFileToText(buffer, "test.pdf", "application/pdf");
      const instance = (PDFParse as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(instance.destroy).toHaveBeenCalled();
    });
  });

  // ─── Word (.docx / .doc) ──────────────────────────────────

  describe("Word (.docx/.doc)", () => {
    it("should parse DOCX by MIME type", async () => {
      const buffer = Buffer.from("fake-docx");
      const result = await parseFileToText(
        buffer,
        "test.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      );
      expect(result).toBe("Word document text content");
      expect(mammoth.extractRawText).toHaveBeenCalledWith({ buffer });
    });

    it("should parse DOC by legacy MIME type", async () => {
      const buffer = Buffer.from("fake-doc");
      const result = await parseFileToText(buffer, "test.doc", "application/msword");
      expect(result).toBe("Word document text content");
    });

    it("should parse DOCX by extension", async () => {
      const buffer = Buffer.from("fake-docx");
      const result = await parseFileToText(buffer, "report.docx", "");
      expect(result).toBe("Word document text content");
    });

    it("should parse DOC by extension", async () => {
      const buffer = Buffer.from("fake-doc");
      const result = await parseFileToText(buffer, "legacy.doc", "");
      expect(result).toBe("Word document text content");
    });
  });

  // ─── Excel (.xlsx / .xls) ────────────────────────────────

  describe("Excel (.xlsx/.xls)", () => {
    it("should parse XLSX by MIME type", async () => {
      const buffer = Buffer.from("fake-xlsx");
      const result = await parseFileToText(
        buffer,
        "data.xlsx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      expect(result).toBe("Col1,Col2\nA,B\nC,D");
      expect(XLSX.read).toHaveBeenCalledWith(buffer, { type: "buffer" });
    });

    it("should parse XLS by legacy MIME type", async () => {
      const buffer = Buffer.from("fake-xls");
      const result = await parseFileToText(buffer, "data.xls", "application/vnd.ms-excel");
      expect(result).toBe("Col1,Col2\nA,B\nC,D");
    });

    it("should parse XLSX by extension", async () => {
      const buffer = Buffer.from("fake-xlsx");
      const result = await parseFileToText(buffer, "report.xlsx", "");
      expect(result).toBe("Col1,Col2\nA,B\nC,D");
    });

    it("should handle multi-sheet workbook", async () => {
      vi.mocked(XLSX.read).mockReturnValueOnce({
        SheetNames: ["Data", "Summary"],
        Sheets: { Data: {}, Summary: {} },
      } as ReturnType<typeof XLSX.read>);
      vi.mocked(XLSX.utils.sheet_to_csv)
        .mockReturnValueOnce("A,B\n1,2")
        .mockReturnValueOnce("X,Y\n3,4");

      const buffer = Buffer.from("fake-xlsx");
      const result = await parseFileToText(buffer, "multi.xlsx", "");
      expect(result).toContain("--- Лист: Data ---");
      expect(result).toContain("--- Лист: Summary ---");
    });

    it("should skip empty sheets", async () => {
      vi.mocked(XLSX.read).mockReturnValueOnce({
        SheetNames: ["Data", "Empty"],
        Sheets: { Data: {}, Empty: {} },
      } as ReturnType<typeof XLSX.read>);
      vi.mocked(XLSX.utils.sheet_to_csv)
        .mockReturnValueOnce("A,B\n1,2")
        .mockReturnValueOnce("   ");

      const buffer = Buffer.from("fake-xlsx");
      const result = await parseFileToText(buffer, "sparse.xlsx", "");
      expect(result).toContain("A,B");
      expect(result).not.toContain("Empty");
    });
  });

  // ─── CSV ──────────────────────────────────────────────────

  describe("CSV (.csv)", () => {
    it("should parse CSV by MIME type", async () => {
      const csvContent = "Name,Age\nAlice,30\nBob,25";
      const buffer = Buffer.from(csvContent, "utf-8");
      const result = await parseFileToText(buffer, "data.csv", "text/csv");
      expect(result).toBe(csvContent);
    });

    it("should parse CSV by extension", async () => {
      const csvContent = "id,value\n1,test";
      const buffer = Buffer.from(csvContent, "utf-8");
      const result = await parseFileToText(buffer, "export.csv", "");
      expect(result).toBe(csvContent);
    });

    it("should trim whitespace from CSV", async () => {
      const buffer = Buffer.from("  a,b\n1,2  \n", "utf-8");
      const result = await parseFileToText(buffer, "trim.csv", "text/csv");
      expect(result).toBe("a,b\n1,2");
    });
  });

  // ─── HTML ─────────────────────────────────────────────────

  describe("HTML (.html/.htm)", () => {
    it("should parse HTML by MIME type", async () => {
      const html = "<html><body><p>Hello world</p></body></html>";
      const buffer = Buffer.from(html, "utf-8");
      const result = await parseFileToText(buffer, "page.html", "text/html");
      expect(result).toContain("Hello world");
    });

    it("should strip script tags", async () => {
      const html = '<p>Text</p><script>alert("xss")</script><p>More</p>';
      const buffer = Buffer.from(html, "utf-8");
      const result = await parseFileToText(buffer, "page.html", "text/html");
      expect(result).not.toContain("alert");
      expect(result).not.toContain("script");
      expect(result).toContain("Text");
      expect(result).toContain("More");
    });

    it("should strip style tags", async () => {
      const html = "<style>.big{font-size:99px}</style><p>Content</p>";
      const buffer = Buffer.from(html, "utf-8");
      const result = await parseFileToText(buffer, "page.html", "text/html");
      expect(result).not.toContain("font-size");
      expect(result).toContain("Content");
    });

    it("should decode HTML entities", async () => {
      const html = "<p>&amp; &lt; &gt; &quot; &#39; &nbsp;</p>";
      const buffer = Buffer.from(html, "utf-8");
      const result = await parseFileToText(buffer, "entities.html", "text/html");
      expect(result).toContain("&");
      expect(result).toContain("<");
      expect(result).toContain(">");
      expect(result).toContain('"');
      expect(result).toContain("'");
    });

    it("should parse by .htm extension", async () => {
      const html = "<p>HTM format</p>";
      const buffer = Buffer.from(html, "utf-8");
      const result = await parseFileToText(buffer, "old.htm", "");
      expect(result).toContain("HTM format");
    });

    it("should collapse whitespace", async () => {
      const html = "<p>Hello    \n\n    world</p>";
      const buffer = Buffer.from(html, "utf-8");
      const result = await parseFileToText(buffer, "space.html", "text/html");
      expect(result).toBe("Hello world");
    });
  });

  // ─── PPTX ────────────────────────────────────────────────

  describe("PPTX (.pptx)", () => {
    it("should parse PPTX by MIME type", async () => {
      const buffer = Buffer.from("fake-pptx");
      const result = await parseFileToText(
        buffer,
        "slides.pptx",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation"
      );
      expect(result).toBe("Extracted text from office document");
      expect(parseOffice).toHaveBeenCalledWith(buffer);
    });

    it("should parse PPTX by extension", async () => {
      const buffer = Buffer.from("fake-pptx");
      const result = await parseFileToText(buffer, "presentation.pptx", "");
      expect(result).toBe("Extracted text from office document");
    });
  });

  // ─── RTF ──────────────────────────────────────────────────

  describe("RTF (.rtf)", () => {
    it("should parse RTF by MIME type", async () => {
      const buffer = Buffer.from("fake-rtf");
      const result = await parseFileToText(buffer, "doc.rtf", "application/rtf");
      expect(result).toBe("Extracted text from office document");
      expect(parseOffice).toHaveBeenCalledWith(buffer);
    });

    it("should parse RTF by extension", async () => {
      const buffer = Buffer.from("fake-rtf");
      const result = await parseFileToText(buffer, "letter.rtf", "");
      expect(result).toBe("Extracted text from office document");
    });
  });

  // ─── Plain text / Markdown ────────────────────────────────

  describe("Plain text / Markdown", () => {
    it("should parse TXT by MIME type", async () => {
      const buffer = Buffer.from("Simple text content", "utf-8");
      const result = await parseFileToText(buffer, "file.txt", "text/plain");
      expect(result).toBe("Simple text content");
    });

    it("should parse TXT by extension", async () => {
      const buffer = Buffer.from("Text by extension", "utf-8");
      const result = await parseFileToText(buffer, "notes.txt", "");
      expect(result).toBe("Text by extension");
    });

    it("should parse Markdown by extension", async () => {
      const buffer = Buffer.from("# Heading\n\nParagraph", "utf-8");
      const result = await parseFileToText(buffer, "readme.md", "");
      expect(result).toBe("# Heading\n\nParagraph");
    });

    it("should trim whitespace", async () => {
      const buffer = Buffer.from("  content with spaces  \n", "utf-8");
      const result = await parseFileToText(buffer, "file.txt", "text/plain");
      expect(result).toBe("content with spaces");
    });
  });

  // ─── Error handling ───────────────────────────────────────

  describe("Error handling", () => {
    it("should throw for unsupported file type", async () => {
      const buffer = Buffer.from("data");
      await expect(
        parseFileToText(buffer, "file.xyz", "application/octet-stream")
      ).rejects.toThrow("Неподдерживаемый тип файла");
    });

    it("should throw with MIME type in error message", async () => {
      const buffer = Buffer.from("data");
      await expect(
        parseFileToText(buffer, "file.unknown", "application/x-binary")
      ).rejects.toThrow("application/x-binary");
    });

    it("should throw with extension in error when no MIME", async () => {
      const buffer = Buffer.from("data");
      await expect(
        parseFileToText(buffer, "file.rar", "")
      ).rejects.toThrow("rar");
    });
  });
});
