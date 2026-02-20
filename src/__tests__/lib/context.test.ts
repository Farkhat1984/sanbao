import { describe, it, expect, vi } from "vitest";

// Mock prisma for buildCompactionPrompt (now async, reads from DB)
vi.mock("@/lib/prisma", () => ({
  prisma: {
    systemSetting: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
  },
}));

import {
  estimateTokens,
  estimateMessagesTokens,
  checkContextWindow,
  splitMessagesForCompaction,
  buildSystemPromptWithContext,
  buildCompactionPrompt,
} from "@/lib/context";

// ─── estimateTokens ──────────────────────────────────────

describe("estimateTokens", () => {
  it("returns 1 for empty string", () => {
    expect(estimateTokens("")).toBe(1);
  });

  it("estimates ~1/3 of character count", () => {
    expect(estimateTokens("hello world")).toBe(4); // 11 / 3 = 3.67 → 4
  });

  it("handles long text", () => {
    const text = "a".repeat(3000);
    expect(estimateTokens(text)).toBe(1000);
  });

  it("handles Cyrillic text", () => {
    const text = "Привет мир"; // 10 chars (Cyrillic)
    expect(estimateTokens(text)).toBe(4); // 10/3 = 3.33 → 4
  });
});

// ─── estimateMessagesTokens ──────────────────────────────

describe("estimateMessagesTokens", () => {
  it("sums tokens across messages", () => {
    const messages = [
      { role: "user", content: "hello" },
      { role: "assistant", content: "hi there" },
    ];
    expect(estimateMessagesTokens(messages)).toBe(
      estimateTokens("hello") + estimateTokens("hi there")
    );
  });

  it("handles empty messages array", () => {
    expect(estimateMessagesTokens([])).toBe(0);
  });

  it("handles messages with empty content", () => {
    const messages = [{ role: "user", content: "" }];
    expect(estimateMessagesTokens(messages)).toBe(1); // min 1
  });
});

// ─── checkContextWindow ─────────────────────────────────

describe("checkContextWindow", () => {
  const messages = [
    { role: "user", content: "a".repeat(300) },
    { role: "assistant", content: "b".repeat(600) },
  ];

  it("calculates usage percent correctly", () => {
    const result = checkContextWindow(messages, 100, 1000);
    // (100 + 200 + 100) tokens / 1000 = 40%
    expect(result.usagePercent).toBeGreaterThan(0);
    expect(result.usagePercent).toBeLessThan(1);
    expect(result.contextWindowSize).toBe(1000);
  });

  it("triggers compaction at 70% threshold", () => {
    // Make large messages that exceed 70%
    const bigMessages = [
      { role: "user", content: "x".repeat(2100) }, // ~700 tokens
    ];
    const result = checkContextWindow(bigMessages, 100, 1000, 0.7);
    expect(result.needsCompaction).toBe(true);
    expect(result.usagePercent).toBeGreaterThanOrEqual(0.7);
  });

  it("does not trigger compaction below threshold", () => {
    const smallMessages = [
      { role: "user", content: "hi" },
    ];
    const result = checkContextWindow(smallMessages, 10, 1000, 0.7);
    expect(result.needsCompaction).toBe(false);
  });

  it("handles zero context window", () => {
    const result = checkContextWindow(messages, 100, 0);
    expect(result.usagePercent).toBe(0);
    expect(result.needsCompaction).toBe(false);
  });
});

// ─── splitMessagesForCompaction ──────────────────────────

describe("splitMessagesForCompaction", () => {
  const msgs = Array.from({ length: 20 }, (_, i) => ({
    role: i % 2 === 0 ? "user" : "assistant",
    content: `message ${i}`,
  }));

  it("keeps last N messages", () => {
    const { messagesToKeep, messagesToSummarize } = splitMessagesForCompaction(msgs, 12);
    expect(messagesToKeep).toHaveLength(12);
    expect(messagesToSummarize).toHaveLength(8);
    expect(messagesToKeep[0].content).toBe("message 8");
    expect(messagesToKeep[11].content).toBe("message 19");
  });

  it("returns all messages as keep if count <= keepLast", () => {
    const shortMsgs = msgs.slice(0, 5);
    const { messagesToKeep, messagesToSummarize } = splitMessagesForCompaction(shortMsgs, 12);
    expect(messagesToKeep).toHaveLength(5);
    expect(messagesToSummarize).toHaveLength(0);
  });

  it("handles exactly keepLast messages", () => {
    const exactMsgs = msgs.slice(0, 12);
    const { messagesToKeep, messagesToSummarize } = splitMessagesForCompaction(exactMsgs, 12);
    expect(messagesToKeep).toHaveLength(12);
    expect(messagesToSummarize).toHaveLength(0);
  });

  it("handles empty messages", () => {
    const { messagesToKeep, messagesToSummarize } = splitMessagesForCompaction([], 12);
    expect(messagesToKeep).toHaveLength(0);
    expect(messagesToSummarize).toHaveLength(0);
  });
});

// ─── buildSystemPromptWithContext ────────────────────────

describe("buildSystemPromptWithContext", () => {
  const base = "You are Sanbao.";

  it("includes current date", () => {
    const result = buildSystemPromptWithContext(base, null, null);
    expect(result).toContain("Текущая дата и время:");
    expect(result).toContain(base);
  });

  it("includes user memory when provided", () => {
    const result = buildSystemPromptWithContext(base, null, null, "citation_style: ГОСТ");
    expect(result).toContain("ПАМЯТЬ ПОЛЬЗОВАТЕЛЯ");
    expect(result).toContain("citation_style: ГОСТ");
  });

  it("includes conversation summary", () => {
    const result = buildSystemPromptWithContext(base, "User asked about contracts", null);
    expect(result).toContain("КРАТКОЕ СОДЕРЖАНИЕ");
    expect(result).toContain("User asked about contracts");
  });

  it("includes plan memory", () => {
    const result = buildSystemPromptWithContext(base, null, "Decision: use ГОСТ format");
    expect(result).toContain("ПАМЯТЬ ПЛАНИРОВАНИЯ");
    expect(result).toContain("Decision: use ГОСТ format");
  });

  it("includes tasks context", () => {
    const result = buildSystemPromptWithContext(base, null, null, null, "Task 1: review doc (50%)");
    expect(result).toContain("АКТИВНЫЕ ЗАДАЧИ");
    expect(result).toContain("Task 1: review doc");
  });

  it("includes all context sections when provided", () => {
    const result = buildSystemPromptWithContext(
      base, "summary text", "plan text", "memory text", "tasks text"
    );
    expect(result).toContain("ПАМЯТЬ ПОЛЬЗОВАТЕЛЯ");
    expect(result).toContain("КРАТКОЕ СОДЕРЖАНИЕ");
    expect(result).toContain("ПАМЯТЬ ПЛАНИРОВАНИЯ");
    expect(result).toContain("АКТИВНЫЕ ЗАДАЧИ");
  });

  it("omits null sections", () => {
    const result = buildSystemPromptWithContext(base, null, null, null, null);
    expect(result).not.toContain("ПАМЯТЬ ПОЛЬЗОВАТЕЛЯ");
    expect(result).not.toContain("КРАТКОЕ СОДЕРЖАНИЕ");
    expect(result).not.toContain("ПАМЯТЬ ПЛАНИРОВАНИЯ");
    expect(result).not.toContain("АКТИВНЫЕ ЗАДАЧИ");
  });
});

// ─── buildCompactionPrompt ──────────────────────────────

describe("buildCompactionPrompt", () => {
  const messages = [
    { role: "user", content: "Создай договор аренды" },
    { role: "assistant", content: "Вот договор аренды..." },
  ];

  it("builds initial compaction prompt without existing summary", async () => {
    const result = await buildCompactionPrompt(null, messages);
    expect(result).toContain("[USER]: Создай договор аренды");
    expect(result).toContain("[ASSISTANT]: Вот договор аренды...");
    expect(result).toContain("РАЗГОВОР:");
    expect(result).not.toContain("ПРЕДЫДУЩЕЕ КРАТКОЕ СОДЕРЖАНИЕ");
  });

  it("builds update prompt with existing summary", async () => {
    const result = await buildCompactionPrompt("User requested a rental agreement", messages);
    expect(result).toContain("ПРЕДЫДУЩЕЕ КРАТКОЕ СОДЕРЖАНИЕ:");
    expect(result).toContain("User requested a rental agreement");
    expect(result).toContain("НОВЫЕ СООБЩЕНИЯ ДЛЯ ВКЛЮЧЕНИЯ:");
    expect(result).toContain("[USER]: Создай договор аренды");
  });

  it("includes document preservation instruction", async () => {
    const result = await buildCompactionPrompt(null, messages);
    expect(result).toContain("sanbao-doc");
    expect(result).toContain("800 слов");
  });
});
