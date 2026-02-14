import { estimateTokens } from "./context";

export function buildMemoryContext(
  memories: Array<{ key: string; content: string }>,
  maxTokens: number = 500
): string | null {
  const lines: string[] = [];
  let totalTokens = 0;

  for (const m of memories) {
    const line = `- ${m.key}: ${m.content}`;
    const lineTokens = estimateTokens(line);
    if (totalTokens + lineTokens > maxTokens) break;
    lines.push(line);
    totalTokens += lineTokens;
  }

  return lines.length > 0 ? lines.join("\n") : null;
}
