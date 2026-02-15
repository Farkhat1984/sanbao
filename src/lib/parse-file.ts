import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import { parseOffice } from "officeparser";

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

  // CSV
  if (mimeType === "text/csv" || ext === "csv") {
    return buffer.toString("utf-8").trim();
  }

  // HTML
  if (mimeType === "text/html" || ext === "html" || ext === "htm") {
    let html = buffer.toString("utf-8");
    html = html.replace(/<script[\s\S]*?<\/script>/gi, "");
    html = html.replace(/<style[\s\S]*?<\/style>/gi, "");
    html = html.replace(/<[^>]+>/g, " ");
    html = html
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
    return html.replace(/\s+/g, " ").trim();
  }

  // PPTX
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    ext === "pptx"
  ) {
    const ast = await parseOffice(buffer);
    return ast.toText().trim();
  }

  // RTF
  if (mimeType === "application/rtf" || ext === "rtf") {
    const ast = await parseOffice(buffer);
    return ast.toText().trim();
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
