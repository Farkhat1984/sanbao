import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    systemSetting: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
  },
}));

import { buildCompactionPrompt } from "@/lib/context";
import { resetPromptCache } from "@/lib/prompts";

describe("buildCompactionPrompt (async)", () => {
  beforeEach(() => {
    resetPromptCache();
  });

  it("returns a string (is async)", async () => {
    const result = buildCompactionPrompt(null, [
      { role: "user", content: "Привет" },
      { role: "assistant", content: "Здравствуйте!" },
    ]);
    // Should be a promise
    expect(result).toBeInstanceOf(Promise);
    const text = await result;
    expect(typeof text).toBe("string");
  });

  it("uses initial compaction template when no existing summary", async () => {
    const result = await buildCompactionPrompt(null, [
      { role: "user", content: "Hello" },
    ]);
    expect(result).toContain("[USER]: Hello");
    expect(result).toContain("краткое содержание");
    expect(result).not.toContain("{{CONVERSATION}}");
  });

  it("uses update compaction template when existing summary provided", async () => {
    const result = await buildCompactionPrompt("Existing summary text", [
      { role: "user", content: "New message" },
    ]);
    expect(result).toContain("Existing summary text");
    expect(result).toContain("[USER]: New message");
    expect(result).not.toContain("{{SUMMARY}}");
    expect(result).not.toContain("{{CONVERSATION}}");
    expect(result).toContain("обновлённое краткое содержание");
  });

  it("formats multiple messages correctly", async () => {
    const result = await buildCompactionPrompt(null, [
      { role: "user", content: "Вопрос 1" },
      { role: "assistant", content: "Ответ 1" },
      { role: "user", content: "Вопрос 2" },
    ]);
    expect(result).toContain("[USER]: Вопрос 1");
    expect(result).toContain("[ASSISTANT]: Ответ 1");
    expect(result).toContain("[USER]: Вопрос 2");
  });
});
