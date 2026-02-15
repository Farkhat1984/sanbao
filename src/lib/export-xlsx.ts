import * as XLSX from "xlsx";
import { sanitizeFilename } from "./export-utils";

interface TableData {
  headers: string[];
  rows: string[][];
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
  const rows: string[][] = [];

  for (let i = startIdx; i < lines.length; i++) {
    const row = parseRow(lines[i]);
    if (row.length > 0) rows.push(row);
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

export function exportAsXlsx(content: string, title: string): void {
  const wb = XLSX.utils.book_new();
  const tables = extractTables(content);

  if (tables.length > 0) {
    tables.forEach((table, idx) => {
      const aoa = [table.headers, ...table.rows];
      const ws = XLSX.utils.aoa_to_sheet(aoa);
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
