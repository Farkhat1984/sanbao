import { CONTEXT_COMPACTION_THRESHOLD, CONTEXT_KEEP_LAST_MESSAGES, DEFAULT_TIMEZONE } from "@/lib/constants";
import { getPrompt, interpolatePrompt } from "@/lib/prompts";
import { getSettingNumber } from "@/lib/settings";

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

export async function checkContextWindow(
  messages: Array<{ role: string; content: string }>,
  systemPromptTokens: number,
  contextWindowSize: number,
  threshold?: number
): Promise<ContextCheckResult> {
  const effectiveThreshold = threshold ?? await getSettingNumber("context_compaction_threshold");
  const messageTokens = estimateMessagesTokens(messages);
  const totalTokens = messageTokens + systemPromptTokens;
  const usagePercent = contextWindowSize > 0 ? totalTokens / contextWindowSize : 0;
  return {
    totalTokens,
    contextWindowSize,
    usagePercent,
    needsCompaction: usagePercent >= effectiveThreshold,
  };
}

// ─── Message splitting for compaction ───────────────────

export interface CompactionSplit {
  messagesToSummarize: Array<{ role: string; content: string }>;
  messagesToKeep: Array<{ role: string; content: string }>;
}

export async function splitMessagesForCompaction(
  messages: Array<{ role: string; content: string }>,
  keepLast?: number
): Promise<CompactionSplit> {
  const effectiveKeepLast = keepLast ?? await getSettingNumber("context_keep_last_messages");
  if (messages.length <= effectiveKeepLast) {
    return { messagesToSummarize: [], messagesToKeep: messages };
  }
  const splitPoint = messages.length - effectiveKeepLast;
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
    timeZone: DEFAULT_TIMEZONE,
  }).format(now);
  const isoStr = now.toISOString();

  let result = `Current date and time: ${dateStr} (${isoStr}, ${DEFAULT_TIMEZONE})\n\n${base}`;

  if (userMemory) {
    result += `\n\n--- USER MEMORY (preferences and standards) ---\n${userMemory}\n--- END USER MEMORY ---`;
  }

  if (summary) {
    result += `\n\n--- CONVERSATION SUMMARY (previous context) ---\n${summary}\n--- END CONVERSATION SUMMARY ---`;
  }

  if (planMemory) {
    result += `\n\n--- PLANNING MEMORY (key decisions and context) ---\n${planMemory}\n--- END PLANNING MEMORY ---`;
  }

  if (tasksContext) {
    result += `\n\n--- ACTIVE TASKS ---\n${tasksContext}\n--- END TASKS ---`;
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
