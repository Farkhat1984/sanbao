import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import * as XLSX from "xlsx";

export async function parseFileToText(
  buffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<string> {
  const ext = fileName.toLowerCase().split(".").pop() || "";

  // PDF
  if (mimeType === "application/pdf" || ext === "pdf") {
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getText();
      return result.text.trim();
    } finally {
      await parser.destroy().catch(() => {});
    }
  }

  // Word (.docx / .doc)
  if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/msword" ||
    ext === "docx" ||
    ext === "doc"
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value.trim();
  }

  // Excel (.xlsx / .xls)
  if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType === "application/vnd.ms-excel" ||
    ext === "xlsx" ||
    ext === "xls"
  ) {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheets: string[] = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(sheet);
      if (csv.trim()) {
        sheets.push(
          workbook.SheetNames.length > 1
            ? `--- Лист: ${sheetName} ---\n${csv}`
            : csv
        );
      }
    }

    return sheets.join("\n\n").trim();
  }

  // Plain text / Markdown
  if (
    mimeType === "text/plain" ||
    ext === "txt" ||
    ext === "md"
  ) {
    return buffer.toString("utf-8").trim();
  }

  throw new Error(`Неподдерживаемый тип файла: ${mimeType || ext}`);
}
