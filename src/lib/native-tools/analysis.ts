import { registerNativeTool } from "./registry";
import {
  NATIVE_TOOL_CSV_MAX_BYTES,
  NATIVE_TOOL_CSV_MAX_ROWS,
} from "../constants";

// ─── Safe math evaluator ───────────────────────────────

const ALLOWED_MATH_PATTERN = /^[\d\s+\-*/%().,eE]+$/;
const MAX_EXPRESSION_LENGTH = 500;
const MAX_PAREN_DEPTH = 20;

const MATH_FUNCTIONS: Record<string, (...args: number[]) => number> = {
  abs: Math.abs,
  ceil: Math.ceil,
  floor: Math.floor,
  round: Math.round,
  sqrt: Math.sqrt,
  pow: Math.pow,
  min: Math.min,
  max: Math.max,
  log: Math.log,
  log10: Math.log10,
  log2: Math.log2,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  PI: () => Math.PI,
  E: () => Math.E,
};

function safeEvaluate(expression: string): number {
  let expr = expression.trim();

  if (expr.length > MAX_EXPRESSION_LENGTH) {
    throw new Error(`Выражение слишком длинное (макс. ${MAX_EXPRESSION_LENGTH} символов)`);
  }

  // Check parentheses depth to prevent stack overflow
  let depth = 0;
  for (const ch of expr) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (depth > MAX_PAREN_DEPTH) {
      throw new Error("Слишком глубокая вложенность скобок");
    }
  }
  if (depth !== 0) {
    throw new Error("Несбалансированные скобки");
  }

  // Replace known function calls: sqrt(x) → __fn_sqrt(x)
  for (const fn of Object.keys(MATH_FUNCTIONS)) {
    const regex = new RegExp(`\\b${fn}\\b`, "g");
    expr = expr.replace(regex, `__fn_${fn}`);
  }

  // Check only safe characters remain (after function substitution)
  const cleaned = expr.replace(/__fn_\w+/g, "0");
  if (!ALLOWED_MATH_PATTERN.test(cleaned)) {
    throw new Error("Выражение содержит недопустимые символы");
  }

  // Reject any remaining letter sequences (not part of known functions)
  if (/[a-df-zA-DF-Z]/.test(cleaned)) {
    throw new Error("Выражение содержит недопустимые символы");
  }

  // Blocklist dangerous patterns that could escape the sandbox
  const DANGEROUS = /constructor|prototype|__proto__|this|global|process|require|import|window|eval|Function/i;
  if (DANGEROUS.test(expr)) {
    throw new Error("Выражение содержит запрещённые конструкции");
  }

  // Build evaluator function with Math functions in scope
  const fnArgs = Object.keys(MATH_FUNCTIONS).map((k) => `__fn_${k}`);
  const fnVals = Object.values(MATH_FUNCTIONS);

  const evaluator = new Function(...fnArgs, `"use strict"; return (${expr});`);
  const result = evaluator(...fnVals);

  if (typeof result !== "number" || !isFinite(result)) {
    throw new Error("Результат не является конечным числом");
  }

  return result;
}

// ─── calculate ─────────────────────────────────────────

registerNativeTool({
  name: "calculate",
  description:
    "Выполняет точные математические вычисления. Поддерживает: арифметику (+, -, *, /, %), степени (pow), корни (sqrt), тригонометрию (sin, cos, tan), логарифмы (log, log10, log2), округление (round, floor, ceil), abs, min, max, PI, E.",
  parameters: {
    type: "object",
    properties: {
      expression: {
        type: "string",
        description: "Математическое выражение. Примеры: '2 + 2', 'sqrt(144)', 'pow(2, 10)', 'round(3.14159 * 100) / 100'",
      },
    },
    required: ["expression"],
  },
  async execute(args) {
    const expression = args.expression as string;
    try {
      const result = safeEvaluate(expression);
      return JSON.stringify({ expression, result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return JSON.stringify({ error: msg, expression });
    }
  },
});

// ─── Inline CSV parser ─────────────────────────────────

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let current = "";
  let inQuotes = false;
  const row: string[] = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === "," || ch === ";") {
        row.push(current.trim());
        current = "";
      } else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        row.push(current.trim());
        current = "";
        if (row.some((c) => c !== "")) rows.push([...row]);
        row.length = 0;
      } else {
        current += ch;
      }
    }
  }
  // Last row
  row.push(current.trim());
  if (row.some((c) => c !== "")) rows.push([...row]);

  return rows;
}

type AggOp = "sum" | "avg" | "min" | "max" | "count" | "median";

function aggregate(values: number[], op: AggOp): number {
  if (values.length === 0) return 0;
  switch (op) {
    case "sum":
      return values.reduce((a, b) => a + b, 0);
    case "avg":
      return values.reduce((a, b) => a + b, 0) / values.length;
    case "min":
      return Math.min(...values);
    case "max":
      return Math.max(...values);
    case "count":
      return values.length;
    case "median": {
      const sorted = [...values].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    }
  }
}

// ─── analyze_csv ───────────────────────────────────────

registerNativeTool({
  name: "analyze_csv",
  description:
    "Анализирует CSV-данные: подсчитывает суммы, средние, группировки. Принимает CSV-текст напрямую. Лимит: 100KB / 10000 строк.",
  parameters: {
    type: "object",
    properties: {
      csv: {
        type: "string",
        description: "CSV-данные (с заголовками). Разделитель: запятая или точка с запятой.",
      },
      value_column: {
        type: "string",
        description: "Название столбца с числовыми значениями для агрегации",
      },
      group_by: {
        type: "string",
        description: "Название столбца для группировки (необязательно)",
      },
      operation: {
        type: "string",
        enum: ["sum", "avg", "min", "max", "count", "median"],
        description: "Операция агрегации. По умолчанию sum.",
      },
    },
    required: ["csv", "value_column"],
  },
  async execute(args) {
    const csv = args.csv as string;
    const valueCol = args.value_column as string;
    const groupBy = args.group_by as string | undefined;
    const op = (args.operation as AggOp) || "sum";

    // Size check
    if (Buffer.byteLength(csv, "utf-8") > NATIVE_TOOL_CSV_MAX_BYTES) {
      return JSON.stringify({ error: `CSV превышает лимит ${NATIVE_TOOL_CSV_MAX_BYTES / 1024}KB` });
    }

    const rows = parseCSV(csv);
    if (rows.length < 2) {
      return JSON.stringify({ error: "CSV должен содержать заголовок и хотя бы одну строку данных" });
    }
    if (rows.length - 1 > NATIVE_TOOL_CSV_MAX_ROWS) {
      return JSON.stringify({ error: `CSV превышает лимит ${NATIVE_TOOL_CSV_MAX_ROWS} строк` });
    }

    const headers = rows[0];
    const valueIdx = headers.findIndex(
      (h) => h.toLowerCase() === valueCol.toLowerCase()
    );
    if (valueIdx === -1) {
      return JSON.stringify({
        error: `Столбец "${valueCol}" не найден. Доступные столбцы: ${headers.join(", ")}`,
      });
    }

    const groupIdx = groupBy
      ? headers.findIndex((h) => h.toLowerCase() === groupBy.toLowerCase())
      : -1;
    if (groupBy && groupIdx === -1) {
      return JSON.stringify({
        error: `Столбец группировки "${groupBy}" не найден. Доступные столбцы: ${headers.join(", ")}`,
      });
    }

    const dataRows = rows.slice(1);

    if (groupIdx >= 0) {
      // Grouped aggregation
      const groups = new Map<string, number[]>();
      for (const row of dataRows) {
        const key = row[groupIdx] || "(пусто)";
        const val = parseFloat(row[valueIdx]?.replace(/\s/g, "").replace(",", "."));
        if (isNaN(val)) continue;
        const arr = groups.get(key) || [];
        arr.push(val);
        groups.set(key, arr);
      }

      const result: Record<string, { value: number; count: number }> = {};
      for (const [key, vals] of groups) {
        result[key] = { value: Math.round(aggregate(vals, op) * 100) / 100, count: vals.length };
      }

      return JSON.stringify({
        operation: op,
        column: valueCol,
        groupBy,
        totalRows: dataRows.length,
        groups: result,
      });
    } else {
      // Flat aggregation
      const values: number[] = [];
      for (const row of dataRows) {
        const val = parseFloat(row[valueIdx]?.replace(/\s/g, "").replace(",", "."));
        if (!isNaN(val)) values.push(val);
      }

      return JSON.stringify({
        operation: op,
        column: valueCol,
        totalRows: dataRows.length,
        validValues: values.length,
        result: Math.round(aggregate(values, op) * 100) / 100,
      });
    }
  },
});
