import * as XLSX from "xlsx";
import { sanitizeFilename } from "./export-utils";

type CellValue = string | number | boolean | null;

interface TableData {
  headers: string[];
  rows: CellValue[][];
}

/**
 * Convert a raw cell string to the correct typed value for Excel.
 * - Numbers (incl. negative, decimals, thousands separators) → number
 * - Percentages "45%" → number 0.45 (formatted as %)
 * - Booleans → boolean
 * - Formulas "=SUM(A1:A5)" → kept as string (xlsx lib handles =prefix)
 * - Currency "$ 1,234.56" or "1 234,56 ₸" → number
 * - Empty → null
 * - Everything else → string
 */
function parseCell(raw: string): CellValue {
  const trimmed = raw.trim();
  if (trimmed === "" || trimmed === "-" || trimmed === "—") return null;

  // Formula — keep as-is, xlsx lib will treat =prefix as formula
  if (trimmed.startsWith("=")) return trimmed;

  // Boolean
  const lower = trimmed.toLowerCase();
  if (lower === "true" || lower === "да" || lower === "yes") return true;
  if (lower === "false" || lower === "нет" || lower === "no") return false;

  // Percentage: "45%" or "45.5%"
  const pctMatch = trimmed.match(/^(-?\d[\d\s,.]*)\s*%$/);
  if (pctMatch) {
    const num = parseNumeric(pctMatch[1]);
    if (num !== null) return num / 100;
  }

  // Strip currency symbols and try as number
  const stripped = trimmed
    .replace(/^[₸$€£¥₽]\s*/, "")  // leading currency
    .replace(/\s*[₸$€£¥₽]$/, "")  // trailing currency
    .replace(/\s*(?:тг|руб|сум|тенге)\.?\s*$/i, "")  // text currency
    .trim();

  const num = parseNumeric(stripped);
  if (num !== null) return num;

  return trimmed;
}

/**
 * Parse a numeric string, handling:
 * - "1234" → 1234
 * - "1,234.56" → 1234.56 (English)
 * - "1 234,56" → 1234.56 (Russian/European)
 * - "1234.56" → 1234.56
 * - "-1 234" → -1234
 */
function parseNumeric(s: string): number | null {
  const clean = s.trim();
  if (clean === "") return null;

  // Try direct parse first (handles "1234", "1234.56", "-5")
  if (/^-?\d+(\.\d+)?$/.test(clean)) {
    return Number(clean);
  }

  // English format: "1,234,567.89"
  if (/^-?[\d,]+(\.\d+)?$/.test(clean)) {
    const n = Number(clean.replace(/,/g, ""));
    if (!isNaN(n)) return n;
  }

  // Russian/European format: "1 234 567,89" or "1.234.567,89"
  if (/^-?[\d\s.]+,\d+$/.test(clean) || /^-?[\d\s.]+$/.test(clean)) {
    // spaces or dots as thousand separators, comma as decimal
    const n = Number(
      clean
        .replace(/\s/g, "")
        .replace(/\.(?=\d{3})/g, "")  // dots as thousand sep
        .replace(",", ".")             // comma as decimal
    );
    if (!isNaN(n)) return n;
  }

  // Space as thousands separator, no decimal: "1 234 567"
  if (/^-?\d{1,3}(\s\d{3})+$/.test(clean)) {
    const n = Number(clean.replace(/\s/g, ""));
    if (!isNaN(n)) return n;
  }

  return null;
}

function parseMarkdownTable(lines: string[]): TableData | null {
  if (lines.length < 2) return null;

  const parseRow = (line: string): string[] =>
    line
      .split("|")
      .map((c) => c.trim())
      .filter((c) => c.length > 0 && !/^[-:]+$/.test(c));

  const headers = parseRow(lines[0]);
  if (headers.length === 0) return null;

  const startIdx = lines[1].includes("---") ? 2 : 1;
  const rows: CellValue[][] = [];

  for (let i = startIdx; i < lines.length; i++) {
    const rawRow = parseRow(lines[i]);
    if (rawRow.length > 0) rows.push(rawRow.map(parseCell));
  }

  return { headers, rows };
}

function extractTables(content: string): TableData[] {
  const lines = content.split("\n");
  const tables: TableData[] = [];
  let i = 0;

  while (i < lines.length) {
    if (lines[i].trim().startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i].trim());
        i++;
      }
      const table = parseMarkdownTable(tableLines);
      if (table) tables.push(table);
    } else {
      i++;
    }
  }

  return tables;
}

/**
 * Auto-size columns based on content width.
 */
function autoSizeColumns(ws: XLSX.WorkSheet, data: CellValue[][]): void {
  if (data.length === 0) return;
  const colWidths: number[] = [];
  for (const row of data) {
    row.forEach((cell, idx) => {
      const len = cell != null ? String(cell).length : 0;
      colWidths[idx] = Math.max(colWidths[idx] || 8, Math.min(len + 2, 50));
    });
  }
  ws["!cols"] = colWidths.map((w) => ({ wch: w }));
}

export function exportAsXlsx(content: string, title: string): void {
  const wb = XLSX.utils.book_new();
  const tables = extractTables(content);

  if (tables.length > 0) {
    tables.forEach((table, idx) => {
      const aoa: CellValue[][] = [table.headers, ...table.rows];
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      autoSizeColumns(ws, aoa);
      const sheetName = tables.length === 1 ? "Sheet1" : `Table${idx + 1}`;
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });
  } else {
    // No tables found — export lines as single-column sheet
    const lines = content.split("\n").map((line) => [line]);
    const ws = XLSX.utils.aoa_to_sheet(lines);
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  }

  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${sanitizeFilename(title)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
