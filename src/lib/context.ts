import { CONTEXT_COMPACTION_THRESHOLD, CONTEXT_KEEP_LAST_MESSAGES } from "@/lib/constants";
import { getPrompt, interpolatePrompt } from "@/lib/prompts";

// ─── Context management utilities for autocompact & planning ───

// Cyrillic characters typically take 1-2 chars/token vs 3-4 for Latin.
// We detect predominant script and adjust the divisor accordingly.
const CYRILLIC_RE = /[\u0400-\u04FF]/g;

export function estimateTokens(text: string): number {
  const cyrillicCount = (text.match(CYRILLIC_RE) || []).length;
  const ratio = text.length > 0 ? cyrillicCount / text.length : 0;
  // Blend: pure Latin ≈ /3, pure Cyrillic ≈ /1.5
  const divisor = 3 - ratio * 1.5;
  return Math.max(1, Math.ceil(text.length / divisor));
}

export function estimateMessagesTokens(
  messages: Array<{ role: string; content: string }>
): number {
  return messages.reduce((sum, m) => sum + estimateTokens(m.content || ""), 0);
}

// ─── Context window check ───────────────────────────────

export interface ContextCheckResult {
  totalTokens: number;
  contextWindowSize: number;
  usagePercent: number;
  needsCompaction: boolean;
}

export function checkContextWindow(
  messages: Array<{ role: string; content: string }>,
  systemPromptTokens: number,
  contextWindowSize: number,
  threshold: number = CONTEXT_COMPACTION_THRESHOLD
): ContextCheckResult {
  const messageTokens = estimateMessagesTokens(messages);
  const totalTokens = messageTokens + systemPromptTokens;
  const usagePercent = contextWindowSize > 0 ? totalTokens / contextWindowSize : 0;
  return {
    totalTokens,
    contextWindowSize,
    usagePercent,
    needsCompaction: usagePercent >= threshold,
  };
}

// ─── Message splitting for compaction ───────────────────

export interface CompactionSplit {
  messagesToSummarize: Array<{ role: string; content: string }>;
  messagesToKeep: Array<{ role: string; content: string }>;
}

export function splitMessagesForCompaction(
  messages: Array<{ role: string; content: string }>,
  keepLast: number = CONTEXT_KEEP_LAST_MESSAGES
): CompactionSplit {
  if (messages.length <= keepLast) {
    return { messagesToSummarize: [], messagesToKeep: messages };
  }
  const splitPoint = messages.length - keepLast;
  return {
    messagesToSummarize: messages.slice(0, splitPoint),
    messagesToKeep: messages.slice(splitPoint),
  };
}

// ─── System prompt enrichment ───────────────────────────

export function buildSystemPromptWithContext(
  base: string,
  summary: string | null,
  planMemory: string | null,
  userMemory: string | null = null,
  tasksContext: string | null = null
): string {
  // Always inject current date/time so the model knows "now"
  const now = new Date();
  const dateStr = new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Asia/Almaty",
  }).format(now);
  const isoStr = now.toISOString();

  let result = `Текущая дата и время: ${dateStr} (${isoStr}, Asia/Almaty)\n\n${base}`;

  if (userMemory) {
    result += `\n\n--- ПАМЯТЬ ПОЛЬЗОВАТЕЛЯ (предпочтения и стандарты) ---\n${userMemory}\n--- КОНЕЦ ПАМЯТИ ПОЛЬЗОВАТЕЛЯ ---`;
  }

  if (summary) {
    result += `\n\n--- КРАТКОЕ СОДЕРЖАНИЕ ПРЕДЫДУЩЕЙ ЧАСТИ РАЗГОВОРА ---\n${summary}\n--- КОНЕЦ КРАТКОГО СОДЕРЖАНИЯ ---`;
  }

  if (planMemory) {
    result += `\n\n--- ПАМЯТЬ ПЛАНИРОВАНИЯ (ключевые решения и контекст) ---\n${planMemory}\n--- КОНЕЦ ПАМЯТИ ПЛАНИРОВАНИЯ ---`;
  }

  if (tasksContext) {
    result += `\n\n--- АКТИВНЫЕ ЗАДАЧИ ---\n${tasksContext}\n--- КОНЕЦ ЗАДАЧ ---`;
  }

  return result;
}

// ─── Compaction prompt for LLM ──────────────────────────

export async function buildCompactionPrompt(
  existingSummary: string | null,
  messagesToSummarize: Array<{ role: string; content: string }>
): Promise<string> {
  const conversation = messagesToSummarize
    .map((m) => `[${m.role.toUpperCase()}]: ${m.content}`)
    .join("\n\n");

  if (existingSummary) {
    const template = await getPrompt("prompt_compaction_update");
    return interpolatePrompt(template, { SUMMARY: existingSummary, CONVERSATION: conversation });
  }

  const template = await getPrompt("prompt_compaction_initial");
  return interpolatePrompt(template, { CONVERSATION: conversation });
}
