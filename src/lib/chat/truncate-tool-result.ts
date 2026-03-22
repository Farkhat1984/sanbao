// ─── Tool result truncation ───────────────────────────────
// Truncates large tool results using a head+tail strategy
// (like ChatGPT/Claude) to prevent context overflow while
// preserving the most useful information.

import {
  TOOL_RESULT_MAX_CHARS,
  TOOL_RESULT_TAIL_CHARS,
} from "@/lib/constants";

/**
 * Truncate a tool result to fit within token budget.
 *
 * Strategy: keep head + tail, add truncation metadata.
 * Beginnings typically contain structure/headers,
 * endings contain conclusions.
 *
 * @param content - The raw tool result string
 * @param maxChars - Maximum allowed characters (default from constants)
 * @param tailChars - Characters to preserve from the end (default from constants)
 */
export function truncateToolResult(
  content: string,
  maxChars: number = TOOL_RESULT_MAX_CHARS,
  tailChars: number = TOOL_RESULT_TAIL_CHARS
): string {
  if (!content || content.length <= maxChars) return content ?? "";

  const headChars = maxChars - tailChars - 200; // Reserve space for truncation notice
  const head = content.slice(0, headChars);
  const tail = content.slice(-tailChars);
  const originalKB = (content.length / 1024).toFixed(1);

  return (
    head +
    `\n\n[... обрезано ${originalKB}KB → ${(maxChars / 1024).toFixed(1)}KB — ` +
    `используйте более конкретный запрос для получения нужной информации ...]\n\n` +
    tail
  );
}
