import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import { parseOffice } from "officeparser";

/** Threshold: files with more rows than this get smart preview instead of full dump */
const TABULAR_PREVIEW_THRESHOLD = 50;
/** Number of sample rows to include in preview */
const PREVIEW_SAMPLE_ROWS = 15;

export interface ParseResult {
  /** Text for LLM context (preview for large tabular files, full text for others) */
  text: string;
  /** Full CSV data for tabular files — passed to artifact sandbox, NOT to LLM */
  fullData?: string;
}

/**
 * Build a smart preview of tabular data for LLM context.
 * Includes schema, sample rows, and basic stats — enough to write correct pandas code.
 */
function buildTabularPreview(csv: string, fileName: string, sheetName?: string): { preview: string; rowCount: number } {
  const lines = csv.split("\n").filter((l) => l.trim());
  if (lines.length === 0) return { preview: "", rowCount: 0 };

  const headerLine = lines[0];
  const headers = headerLine.split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const dataLines = lines.slice(1);
  const rowCount = dataLines.length;

  // Parse all values per column for stats
  const columns: string[][] = headers.map(() => []);
  for (const line of dataLines) {
    const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    values.forEach((v, idx) => {
      if (idx < columns.length) columns[idx].push(v);
    });
  }

  // Detect types and compute stats
  const colInfo = headers.map((name, idx) => {
    const vals = columns[idx].filter((v) => v !== "" && v !== "null" && v !== "None");
    const nonNull = vals.length;
    const unique = new Set(vals).size;

    // Type detection
    let type = "string";
    const numericVals = vals.map(Number).filter((n) => !isNaN(n));
    if (numericVals.length > vals.length * 0.8) {
      type = numericVals.every((n) => Number.isInteger(n)) ? "int" : "float";
    } else if (vals.every((v) => /^\d{4}-\d{2}-\d{2}/.test(v))) {
      type = "date";
    }

    const stats: Record<string, string> = {};
    if (type === "int" || type === "float") {
      stats.min = String(Math.min(...numericVals));
      stats.max = String(Math.max(...numericVals));
      stats.mean = (numericVals.reduce((a, b) => a + b, 0) / numericVals.length).toFixed(1);
    }

    return { name, type, nonNull, unique, example: vals[0] || "", stats };
  });

  const label = sheetName ? `${fileName} (лист: ${sheetName})` : fileName;
  let preview = `# Файл: ${label}\n`;
  preview += `# Строк: ${rowCount.toLocaleString()} | Колонок: ${headers.length}\n\n`;

  // Column schema
  preview += `| Колонка | Тип | Заполнено | Уникальных | Пример |\n`;
  preview += `|---------|-----|-----------|------------|--------|\n`;
  for (const col of colInfo) {
    preview += `| ${col.name} | ${col.type} | ${col.nonNull} | ${col.unique} | ${col.example} |\n`;
  }

  // Numeric stats
  const numCols = colInfo.filter((c) => c.type === "int" || c.type === "float");
  if (numCols.length > 0) {
    preview += `\n| Колонка | Min | Max | Среднее |\n`;
    preview += `|---------|-----|-----|---------|\n`;
    for (const col of numCols) {
      preview += `| ${col.name} | ${col.stats.min} | ${col.stats.max} | ${col.stats.mean} |\n`;
    }
  }

  // Sample rows
  const sampleCount = Math.min(PREVIEW_SAMPLE_ROWS, dataLines.length);
  preview += `\nПервые ${sampleCount} строк (CSV):\n\`\`\`\n`;
  preview += headerLine + "\n";
  preview += dataLines.slice(0, sampleCount).join("\n");
  preview += "\n```\n";

  preview += `\nПолные данные (${rowCount.toLocaleString()} строк) доступны в артефакте.\n`;
  preview += `Для Python-артефакта данные автоматически загружены в переменную _FILE_DATA["${fileName}"] как CSV-строка.\n`;
  preview += `Используй: df = pd.read_csv(io.StringIO(_FILE_DATA["${fileName}"]))\n`;

  return { preview, rowCount };
}

export async function parseFileToText(
  buffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<ParseResult> {
  const ext = fileName.toLowerCase().split(".").pop() || "";

  // PDF
  if (mimeType === "application/pdf" || ext === "pdf") {
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getText();
      return { text: result.text.trim() };
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
    return { text: result.value.trim() };
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
    const previews: string[] = [];
    const fullCsvParts: string[] = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(sheet);
      if (!csv.trim()) continue;

      const lines = csv.split("\n").filter((l) => l.trim());
      const rowCount = lines.length - 1; // minus header

      if (rowCount > TABULAR_PREVIEW_THRESHOLD) {
        // Large sheet → smart preview for LLM, full data for artifact
        const sheetLabel = workbook.SheetNames.length > 1 ? sheetName : undefined;
        const { preview } = buildTabularPreview(csv, fileName, sheetLabel);
        previews.push(preview);
        fullCsvParts.push(
          workbook.SheetNames.length > 1
            ? `--- Sheet: ${sheetName} ---\n${csv}`
            : csv
        );
      } else {
        // Small sheet → full data goes to both LLM and artifact
        const text = workbook.SheetNames.length > 1
          ? `--- Лист: ${sheetName} ---\n${csv}`
          : csv;
        previews.push(text);
        fullCsvParts.push(text);
      }
    }

    const text = previews.join("\n\n").trim();
    const fullData = fullCsvParts.join("\n\n").trim();
    // Only return fullData if it's different from text (i.e., was truncated)
    return text !== fullData ? { text, fullData } : { text };
  }

  // CSV
  if (mimeType === "text/csv" || ext === "csv") {
    const raw = buffer.toString("utf-8").trim();
    const lines = raw.split("\n").filter((l) => l.trim());
    const rowCount = lines.length - 1;

    if (rowCount > TABULAR_PREVIEW_THRESHOLD) {
      const { preview } = buildTabularPreview(raw, fileName);
      return { text: preview, fullData: raw };
    }
    return { text: raw };
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
    return { text: html.replace(/\s+/g, " ").trim() };
  }

  // PPTX
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    ext === "pptx"
  ) {
    const ast = await parseOffice(buffer);
    return { text: ast.toText().trim() };
  }

  // RTF
  if (mimeType === "application/rtf" || ext === "rtf") {
    const ast = await parseOffice(buffer);
    return { text: ast.toText().trim() };
  }

  // Plain text / Markdown
  if (
    mimeType === "text/plain" ||
    ext === "txt" ||
    ext === "md"
  ) {
    return { text: buffer.toString("utf-8").trim() };
  }

  throw new Error(`Неподдерживаемый тип файла: ${mimeType || ext}`);
}
