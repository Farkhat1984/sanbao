import { CONTEXT_COMPACTION_THRESHOLD, CONTEXT_KEEP_LAST_MESSAGES } from "@/lib/constants";

// ─── Context management utilities for autocompact & planning ───

export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 3));
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
  let result = base;

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

export function buildCompactionPrompt(
  existingSummary: string | null,
  messagesToSummarize: Array<{ role: string; content: string }>
): string {
  const conversation = messagesToSummarize
    .map((m) => `[${m.role.toUpperCase()}]: ${m.content}`)
    .join("\n\n");

  if (existingSummary) {
    return `Ты — ассистент для сжатия контекста разговора. У тебя есть предыдущее краткое содержание и новые сообщения. Объедини их в обновлённое краткое содержание.

ПРЕДЫДУЩЕЕ КРАТКОЕ СОДЕРЖАНИЕ:
${existingSummary}

НОВЫЕ СООБЩЕНИЯ ДЛЯ ВКЛЮЧЕНИЯ:
${conversation}

Создай обновлённое краткое содержание, которое:
1. Сохраняет все ключевые факты, решения, имена, даты, суммы
2. Сохраняет юридический контекст (статьи законов, ссылки на НПА)
3. Отмечает все созданные документы и их параметры
4. Убирает повторы и малозначимые обмены репликами
5. Написано от третьего лица в прошедшем времени
6. ОБЯЗАТЕЛЬНО сохраняй структуру и ключевое содержание всех созданных документов (<sanbao-doc> тегов) — тип, заголовок, основные разделы, суммы, стороны, реквизиты. Это критически важно для возможности дальнейшего редактирования документов
7. Занимает не более 800 слов

КРАТКОЕ СОДЕРЖАНИЕ:`;
  }

  return `Ты — ассистент для сжатия контекста разговора. Создай краткое содержание следующего разговора.

РАЗГОВОР:
${conversation}

Создай краткое содержание, которое:
1. Сохраняет все ключевые факты, решения, имена, даты, суммы
2. Сохраняет юридический контекст (статьи законов, ссылки на НПА)
3. Отмечает все созданные документы и их параметры
4. Убирает повторы и малозначимые обмены репликами
5. Написано от третьего лица в прошедшем времени
6. ОБЯЗАТЕЛЬНО сохраняй структуру и ключевое содержание всех созданных документов (<sanbao-doc> тегов) — тип, заголовок, основные разделы, суммы, стороны, реквизиты. Это критически важно для возможности дальнейшего редактирования документов
7. Занимает не более 800 слов

КРАТКОЕ СОДЕРЖАНИЕ:`;
}
