import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma before importing prompts
vi.mock("@/lib/prisma", () => ({
  prisma: {
    systemSetting: {
      findUnique: vi.fn(),
    },
  },
}));

import {
  getPrompt,
  resetPromptCache,
  interpolatePrompt,
  PROMPT_REGISTRY,
  PROMPT_META,
} from "@/lib/prompts";
import { prisma } from "@/lib/prisma";

const mockFindUnique = prisma.systemSetting.findUnique as ReturnType<typeof vi.fn>;

describe("prompts.ts", () => {
  beforeEach(() => {
    resetPromptCache();
    mockFindUnique.mockReset();
  });

  // ─── PROMPT_REGISTRY ──────────────────────────────────────

  describe("PROMPT_REGISTRY", () => {
    it("has exactly 9 keys", () => {
      expect(Object.keys(PROMPT_REGISTRY)).toHaveLength(9);
    });

    it("contains all expected prompt keys", () => {
      const expectedKeys = [
        "prompt_system_global",
        "prompt_fix_code",
        "prompt_gen_skill",
        "prompt_gen_agent",
        "prompt_compaction_initial",
        "prompt_compaction_update",
        "prompt_mode_planning",
        "prompt_mode_websearch",
        "prompt_mode_thinking",
      ];
      for (const key of expectedKeys) {
        expect(PROMPT_REGISTRY).toHaveProperty(key);
        expect(typeof PROMPT_REGISTRY[key]).toBe("string");
        expect(PROMPT_REGISTRY[key].length).toBeGreaterThan(10);
      }
    });

    it("gen_skill has placeholder {{VALID_ICONS}}", () => {
      expect(PROMPT_REGISTRY.prompt_gen_skill).toContain("{{VALID_ICONS}}");
      expect(PROMPT_REGISTRY.prompt_gen_skill).toContain("{{VALID_COLORS}}");
      expect(PROMPT_REGISTRY.prompt_gen_skill).toContain("{{JURISDICTIONS}}");
    });

    it("gen_agent has placeholder {{VALID_ICONS}}", () => {
      expect(PROMPT_REGISTRY.prompt_gen_agent).toContain("{{VALID_ICONS}}");
      expect(PROMPT_REGISTRY.prompt_gen_agent).toContain("{{VALID_COLORS}}");
    });

    it("compaction_initial has {{CONVERSATION}}", () => {
      expect(PROMPT_REGISTRY.prompt_compaction_initial).toContain("{{CONVERSATION}}");
    });

    it("compaction_update has {{SUMMARY}} and {{CONVERSATION}}", () => {
      expect(PROMPT_REGISTRY.prompt_compaction_update).toContain("{{SUMMARY}}");
      expect(PROMPT_REGISTRY.prompt_compaction_update).toContain("{{CONVERSATION}}");
    });
  });

  // ─── PROMPT_META ──────────────────────────────────────────

  describe("PROMPT_META", () => {
    it("has metadata for all 9 keys", () => {
      for (const key of Object.keys(PROMPT_REGISTRY)) {
        expect(PROMPT_META).toHaveProperty(key);
        expect(PROMPT_META[key].label).toBeTruthy();
        expect(PROMPT_META[key].description).toBeTruthy();
      }
    });
  });

  // ─── getPrompt ──────────────────────────────────────────

  describe("getPrompt", () => {
    it("returns default value when no SystemSetting override", async () => {
      mockFindUnique.mockResolvedValue(null);
      const result = await getPrompt("prompt_fix_code");
      expect(result).toBe(PROMPT_REGISTRY.prompt_fix_code);
    });

    it("returns SystemSetting override when present", async () => {
      const override = "Custom fix prompt override";
      mockFindUnique.mockResolvedValue({ key: "prompt_fix_code", value: override });
      const result = await getPrompt("prompt_fix_code");
      expect(result).toBe(override);
    });

    it("ignores empty/whitespace-only overrides", async () => {
      mockFindUnique.mockResolvedValue({ key: "prompt_fix_code", value: "   " });
      const result = await getPrompt("prompt_fix_code");
      expect(result).toBe(PROMPT_REGISTRY.prompt_fix_code);
    });

    it("throws on unknown key", async () => {
      await expect(getPrompt("nonexistent_key")).rejects.toThrow("Unknown prompt key");
    });

    it("falls back to default on DB error", async () => {
      mockFindUnique.mockRejectedValue(new Error("DB down"));
      const result = await getPrompt("prompt_mode_thinking");
      expect(result).toBe(PROMPT_REGISTRY.prompt_mode_thinking);
    });

    it("caches results and avoids repeated DB calls", async () => {
      mockFindUnique.mockResolvedValue(null);
      await getPrompt("prompt_fix_code");
      await getPrompt("prompt_fix_code");
      await getPrompt("prompt_fix_code");
      // Only 1 DB call (cached after first)
      expect(mockFindUnique).toHaveBeenCalledTimes(1);
    });

    it("checks legacy key for prompt_system_global", async () => {
      // First call returns null for prompt_system_global, then returns legacy
      mockFindUnique
        .mockResolvedValueOnce(null) // key: prompt_system_global
        .mockResolvedValueOnce({ key: "system_prompt_global", value: "Legacy override" });

      const result = await getPrompt("prompt_system_global");
      expect(result).toBe("Legacy override");
      expect(mockFindUnique).toHaveBeenCalledTimes(2);
      expect(mockFindUnique).toHaveBeenCalledWith({ where: { key: "system_prompt_global" } });
    });
  });

  // ─── resetPromptCache ──────────────────────────────────

  describe("resetPromptCache", () => {
    it("clears specific key from cache", async () => {
      mockFindUnique.mockResolvedValue(null);
      await getPrompt("prompt_fix_code");
      expect(mockFindUnique).toHaveBeenCalledTimes(1);

      resetPromptCache("prompt_fix_code");
      await getPrompt("prompt_fix_code");
      // Should query DB again after cache clear
      expect(mockFindUnique).toHaveBeenCalledTimes(2);
    });

    it("clears all keys when no argument", async () => {
      mockFindUnique.mockResolvedValue(null);
      await getPrompt("prompt_fix_code");
      await getPrompt("prompt_mode_thinking");
      expect(mockFindUnique).toHaveBeenCalledTimes(2);

      resetPromptCache();
      await getPrompt("prompt_fix_code");
      await getPrompt("prompt_mode_thinking");
      expect(mockFindUnique).toHaveBeenCalledTimes(4);
    });
  });

  // ─── interpolatePrompt ──────────────────────────────────

  describe("interpolatePrompt", () => {
    it("replaces single placeholder", () => {
      const result = interpolatePrompt("Hello {{NAME}}", { NAME: "World" });
      expect(result).toBe("Hello World");
    });

    it("replaces multiple different placeholders", () => {
      const result = interpolatePrompt("{{A}} and {{B}}", { A: "foo", B: "bar" });
      expect(result).toBe("foo and bar");
    });

    it("replaces all occurrences of same placeholder", () => {
      const result = interpolatePrompt("{{X}} then {{X}} again", { X: "hi" });
      expect(result).toBe("hi then hi again");
    });

    it("leaves template unchanged with empty vars", () => {
      const template = "no placeholders here";
      expect(interpolatePrompt(template, {})).toBe(template);
    });

    it("handles multiline content in vars", () => {
      const result = interpolatePrompt("CONV:\n{{CONVERSATION}}\nEND", {
        CONVERSATION: "line1\nline2\nline3",
      });
      expect(result).toContain("line1\nline2\nline3");
    });

    it("works with real compaction template", () => {
      const template = PROMPT_REGISTRY.prompt_compaction_update;
      const result = interpolatePrompt(template, {
        SUMMARY: "Previous summary text",
        CONVERSATION: "[USER]: Hello\n\n[ASSISTANT]: Hi!",
      });
      expect(result).toContain("Previous summary text");
      expect(result).toContain("[USER]: Hello");
      expect(result).not.toContain("{{SUMMARY}}");
      expect(result).not.toContain("{{CONVERSATION}}");
    });
  });
});
