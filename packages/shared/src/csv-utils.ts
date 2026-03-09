/**
 * CSV utilities with formula-injection protection.
 * Escapes fields that start with =, +, -, @ to prevent Excel formula injection.
 */

const FORMULA_PREFIXES = ["=", "+", "-", "@"];

export function escapeCsvField(value: unknown): string {
  const str = value == null ? "" : String(value);

  // Escape formula injection: prefix with single quote if starts with dangerous char
  const needsFormulaEscape = FORMULA_PREFIXES.some((p) => str.startsWith(p));

  // Always quote if contains comma, newline, quote, or needs formula escape
  const needsQuoting = str.includes(",") || str.includes("\n") || str.includes('"') || needsFormulaEscape;

  if (!needsQuoting) return str;

  // Double any existing quotes
  const escaped = str.replace(/"/g, '""');

  // Prepend tab character inside quotes for formula-starting fields (Excel-safe)
  if (needsFormulaEscape) {
    return `"\t${escaped}"`;
  }

  return `"${escaped}"`;
}

export function buildCsvRow(fields: unknown[]): string {
  return fields.map(escapeCsvField).join(",");
}

export function buildCsvDocument(headers: string[], rows: unknown[][]): string {
  const headerLine = buildCsvRow(headers);
  const dataLines = rows.map(buildCsvRow);
  return [headerLine, ...dataLines].join("\n");
}

export function csvResponse(csv: string, filename: string): Response {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
