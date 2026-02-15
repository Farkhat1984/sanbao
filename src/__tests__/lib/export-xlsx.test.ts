import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock xlsx before importing
vi.mock("xlsx", () => {
  const sheets: Record<string, unknown>[] = [];
  return {
    utils: {
      book_new: vi.fn().mockReturnValue({ SheetNames: [], Sheets: {} }),
      aoa_to_sheet: vi.fn().mockReturnValue({}),
      book_append_sheet: vi.fn().mockImplementation((_wb, ws, name) => {
        sheets.push({ ws, name });
      }),
    },
    write: vi.fn().mockReturnValue(new Uint8Array([1, 2, 3])),
    __sheets: sheets,
  };
});

import { exportAsXlsx } from "@/lib/export-xlsx";
import * as XLSX from "xlsx";

let clickedDownload: string | null = null;

beforeEach(() => {
  clickedDownload = null;
  vi.clearAllMocks();
  (XLSX as unknown as { __sheets: unknown[] }).__sheets.length = 0;

  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock-url");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
    if (tag === "a") {
      return {
        set href(_: string) {},
        set download(val: string) { clickedDownload = val; },
        get download() { return clickedDownload || ""; },
        click: vi.fn(),
      } as unknown as HTMLAnchorElement;
    }
    return document.createElement(tag);
  });
});

describe("exportAsXlsx", () => {
  it("should create download with .xlsx extension", () => {
    exportAsXlsx("simple text", "report");
    expect(clickedDownload).toBe("report.xlsx");
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it("should extract markdown tables into sheets", () => {
    const content = "Some text\n\n| Header1 | Header2 |\n| --- | --- |\n| A | B |\n| C | D |\n\nMore text";
    exportAsXlsx(content, "tables");

    expect(XLSX.utils.aoa_to_sheet).toHaveBeenCalled();
    const calls = vi.mocked(XLSX.utils.aoa_to_sheet).mock.calls;
    // Should have one table with headers + rows
    const aoa = calls[0][0] as string[][];
    expect(aoa[0]).toEqual(["Header1", "Header2"]);
    expect(aoa[1]).toEqual(["A", "B"]);
    expect(aoa[2]).toEqual(["C", "D"]);
  });

  it("should create single 'Sheet1' for one table", () => {
    const content = "| H1 | H2 |\n| --- | --- |\n| v1 | v2 |";
    exportAsXlsx(content, "single-table");

    expect(XLSX.utils.book_append_sheet).toHaveBeenCalledTimes(1);
    const sheetName = vi.mocked(XLSX.utils.book_append_sheet).mock.calls[0][2];
    expect(sheetName).toBe("Sheet1");
  });

  it("should create multiple sheets for multiple tables", () => {
    const content = [
      "| A | B |",
      "| --- | --- |",
      "| 1 | 2 |",
      "",
      "Some text between",
      "",
      "| X | Y |",
      "| --- | --- |",
      "| 3 | 4 |",
    ].join("\n");

    exportAsXlsx(content, "multi");

    expect(XLSX.utils.book_append_sheet).toHaveBeenCalledTimes(2);
    const names = vi.mocked(XLSX.utils.book_append_sheet).mock.calls.map((c) => c[2]);
    expect(names).toEqual(["Table1", "Table2"]);
  });

  it("should fallback to lines as single-column if no tables", () => {
    const content = "Line 1\nLine 2\nLine 3";
    exportAsXlsx(content, "no-tables");

    expect(XLSX.utils.book_append_sheet).toHaveBeenCalledTimes(1);
    const aoa = vi.mocked(XLSX.utils.aoa_to_sheet).mock.calls[0][0] as string[][];
    expect(aoa).toEqual([["Line 1"], ["Line 2"], ["Line 3"]]);
  });

  it("should write as xlsx bookType", () => {
    exportAsXlsx("data", "file");
    expect(XLSX.write).toHaveBeenCalledWith(
      expect.anything(),
      { bookType: "xlsx", type: "array" }
    );
  });

  it("should create blob with correct MIME type", () => {
    const blobSpy = vi.spyOn(globalThis, "Blob");
    exportAsXlsx("data", "file");
    expect(blobSpy).toHaveBeenCalledWith(
      [expect.any(Uint8Array)],
      { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }
    );
    blobSpy.mockRestore();
  });

  it("should sanitize filename", () => {
    exportAsXlsx("data", 'bad<>file:name');
    expect(clickedDownload).toBe("badfilename.xlsx");
  });
});
