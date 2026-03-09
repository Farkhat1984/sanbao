import { requireAuth, jsonOk, jsonError, serializeDates } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import type { SkillCategory } from "@prisma/client";
import { checkMinuteRateLimit } from "@/lib/rate-limit";
import { getSettingNumber } from "@/lib/settings";
import { getPrompt, interpolatePrompt } from "@/lib/prompts";
import {
  VALID_ICONS, VALID_COLORS, SKILL_CATEGORIES, JURISDICTIONS,
  DEFAULT_ICON_COLOR, DEFAULT_SKILL_ICON,
  AI_GENERATION_DESCRIPTION_MAX_LENGTH,
} from "@/lib/constants";
import {
  callLlmForJson,
  LlmModelUnavailableError,
  LlmJsonParseError,
} from "@/lib/llm-generate";

const VALID_CATEGORY_VALUES = SKILL_CATEGORIES.map((c) => c.value);

/**
 * POST /api/skills/quick-create
 * Combined generate + save in one request for inline creation from agent form.
 * Input: { description: string, category?: string }
 * Rate limit: 5 requests/minute per user
 */
export async function POST(req: Request) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;

  const rateLimit = await getSettingNumber('rate_skill_quick_per_minute');
  if (!(await checkMinuteRateLimit(`skill-quick:${userId}`, rateLimit))) {
    return jsonError("Слишком много запросов. Подождите минуту.", 429);
  }

  const body = await req.json().catch(() => null);
  if (!body) return jsonError("Неверный JSON", 400);

  const { description, category } = body as { description?: string; category?: string };

  if (!description?.trim() || description.length > AI_GENERATION_DESCRIPTION_MAX_LENGTH) {
    return jsonError("Описание обязательно (макс. 5000 символов)", 400);
  }

  const validCategory = category && VALID_CATEGORY_VALUES.includes(category as typeof VALID_CATEGORY_VALUES[number])
    ? category
    : undefined;

  try {
    // Build user message with optional category context
    let userMsg = `Создай скилл: ${description.trim()}`;
    if (validCategory) {
      userMsg += `. Категория: ${validCategory}`;
    }

    const systemContent = interpolatePrompt(await getPrompt("prompt_gen_skill"), {
      VALID_ICONS: VALID_ICONS.join(", "),
      VALID_COLORS: VALID_COLORS.join(", "),
      JURISDICTIONS: JURISDICTIONS.join(", "),
      CATEGORIES: VALID_CATEGORY_VALUES.join(", "),
    });

    const parsed = await callLlmForJson<Record<string, unknown>>(
      [
        { role: "system", content: systemContent },
        { role: "user", content: userMsg },
      ],
    );

    // Validate and sanitize AI output
    const systemPrompt = (String(parsed.systemPrompt || "")).slice(0, 4000);
    const resolvedCategory = validCategory
      || (VALID_CATEGORY_VALUES.includes(parsed.category as typeof VALID_CATEGORY_VALUES[number]) ? parsed.category : "CUSTOM");
    const resolvedTags = Array.isArray(parsed.tags)
      ? parsed.tags.filter((t: unknown) => typeof t === "string" && (t as string).length <= 50).slice(0, 20)
      : [];

    const skill = await prisma.skill.create({
      data: {
        userId,
        name: String(parsed.name || "Новый скилл"),
        description: String(parsed.description || ""),
        systemPrompt,
        citationRules: String(parsed.citationRules || ""),
        jurisdiction: JURISDICTIONS.includes(parsed.jurisdiction as typeof JURISDICTIONS[number]) ? String(parsed.jurisdiction) : "RU",
        icon: VALID_ICONS.includes(parsed.icon as string) ? String(parsed.icon) : DEFAULT_SKILL_ICON,
        iconColor: VALID_COLORS.includes(parsed.iconColor as string) ? String(parsed.iconColor) : DEFAULT_ICON_COLOR,
        category: resolvedCategory as SkillCategory,
        tags: resolvedTags,
      },
    });

    return jsonOk(serializeDates(skill), 201);
  } catch (e) {
    if (e instanceof LlmModelUnavailableError) {
      return jsonError("Модель не настроена", 503);
    }
    if (e instanceof LlmJsonParseError) {
      return jsonError("Модель вернула некорректный JSON. Попробуйте переформулировать.", 422);
    }
    console.error("Quick-create error:", e);
    return jsonError("Ошибка генерации скилла. Попробуйте ещё раз.", 500);
  }
}
