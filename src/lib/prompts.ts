import { prisma } from "@/lib/prisma";
import { CACHE_TTL } from "@/lib/constants";
import { loadPrompt } from "@/lib/prompt-loader";

// ─── Prompt file name → registry key mapping ────────────────

const PROMPT_FILE_MAP: Record<string, string> = {
  prompt_system_global: "system-global",
  prompt_fix_code: "fix-code",
  prompt_gen_skill: "gen-skill",
  prompt_gen_agent: "gen-agent",
  prompt_compaction_initial: "compaction-initial",
  prompt_compaction_update: "compaction-update",
  prompt_mode_planning: "mode-planning",
  prompt_mode_websearch: "mode-websearch",
  prompt_mode_thinking: "mode-thinking",
  prompt_swarm_classify: "swarm-classify",
  prompt_swarm_synthesize: "swarm-synthesize",
} as const;

// ─── Prompt Registry: all 11 default prompts (loaded from .txt files) ───

export const PROMPT_REGISTRY: Record<string, string> = Object.fromEntries(
  Object.entries(PROMPT_FILE_MAP).map(([key, fileName]) => [
    key,
    loadPrompt(fileName),
  ])
);

// ─── Prompt metadata for admin UI ────────────────────────────

export const PROMPT_META: Record<string, { label: string; description: string }> = {
  prompt_system_global: {
    label: "Global System Prompt",
    description: "Main system prompt for all chats. Defines behavior, tags, response format.",
  },
  prompt_fix_code: {
    label: "Code Fix",
    description: "Prompt for auto-fixing runtime errors in artifact code.",
  },
  prompt_gen_skill: {
    label: "Skill Generation",
    description: "Prompt for AI skill generation. Placeholders: {{VALID_ICONS}}, {{VALID_COLORS}}, {{JURISDICTIONS}}, {{CATEGORIES}}.",
  },
  prompt_gen_agent: {
    label: "Agent Generation",
    description: "Prompt for AI agent generation. Placeholders: {{VALID_ICONS}}, {{VALID_COLORS}}.",
  },
  prompt_compaction_initial: {
    label: "Compaction (Initial)",
    description: "Prompt for initial conversation context compaction. Placeholder: {{CONVERSATION}}.",
  },
  prompt_compaction_update: {
    label: "Compaction (Update)",
    description: "Prompt for updating existing summary. Placeholders: {{SUMMARY}}, {{CONVERSATION}}.",
  },
  prompt_mode_planning: {
    label: "Planning Mode",
    description: "Text appended to system prompt when planning mode is enabled.",
  },
  prompt_mode_websearch: {
    label: "Web Search Mode",
    description: "Text appended to system prompt for web search instructions.",
  },
  prompt_mode_thinking: {
    label: "Thinking Mode",
    description: "Text appended to system prompt when thinking mode is enabled.",
  },
  prompt_swarm_classify: {
    label: "Swarm: Classify",
    description: "Prompt for routing classification in Swarm Mother mode. Placeholder: {{AGENTS}}.",
  },
  prompt_swarm_synthesize: {
    label: "Swarm: Synthesize",
    description: "Prompt for CEO synthesis in Swarm Mother mode. Placeholders: {{ORG_NAME}}, {{AGENT_RESPONSES}}, {{INACCESSIBLE_NOTE}}.",
  },
};

// ─── Cache ──────────────────────────────────────────────────

const _promptCache = new Map<string, { value: string; expiresAt: number }>();

/**
 * Get a prompt by key. Checks cache → SystemSetting → falls back to PROMPT_REGISTRY default.
 * For backward compat, prompt_system_global also checks legacy key "system_prompt_global".
 */
export async function getPrompt(key: string): Promise<string> {
  const fallback = PROMPT_REGISTRY[key];
  if (fallback === undefined) {
    throw new Error(`Unknown prompt key: ${key}`);
  }

  const now = Date.now();
  const cached = _promptCache.get(key);
  if (cached && now < cached.expiresAt) {
    return cached.value;
  }

  try {
    // Check for override in SystemSetting
    let setting = await prisma.systemSetting.findUnique({ where: { key } });

    // Backward compat: prompt_system_global also checks legacy key
    if (!setting && key === "prompt_system_global") {
      setting = await prisma.systemSetting.findUnique({ where: { key: "system_prompt_global" } });
    }

    const value = setting?.value?.trim() || fallback;
    _promptCache.set(key, { value, expiresAt: now + CACHE_TTL });
    return value;
  } catch {
    _promptCache.set(key, { value: fallback, expiresAt: now + CACHE_TTL });
    return fallback;
  }
}

/**
 * Invalidate prompt cache. If key is provided, only that key is cleared.
 * If no key, all prompts are cleared.
 */
export function resetPromptCache(key?: string): void {
  if (key) {
    _promptCache.delete(key);
  } else {
    _promptCache.clear();
  }
}

/**
 * Replace {{VAR}} placeholders in a prompt template with provided values.
 */
export function interpolatePrompt(
  template: string,
  vars: Record<string, string>
): string {
  let result = template;
  for (const [k, v] of Object.entries(vars)) {
    result = result.replaceAll(`{{${k}}}`, v);
  }
  return result;
}
