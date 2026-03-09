import { auth } from "@/lib/auth";
import { jsonOk, jsonError } from "@/lib/api-helpers";
import { checkMinuteRateLimit } from "@/lib/rate-limit";
import { getSettingNumber } from "@/lib/settings";
import {
  VALID_ICONS, VALID_COLORS, SKILL_CATEGORIES, JURISDICTIONS,
  DEFAULT_ICON_COLOR, AI_GENERATION_DESCRIPTION_MAX_LENGTH,
} from "@/lib/constants";
import { getPrompt, interpolatePrompt } from "@/lib/prompts";
import {
  callLlmForJson,
  LlmModelUnavailableError,
  LlmJsonParseError,
} from "@/lib/llm-generate";

const VALID_CATEGORY_VALUES = SKILL_CATEGORIES.map((c) => c.value);

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return jsonError("Unauthorized", 401);
  }

  const rateLimit = await getSettingNumber('rate_skill_gen_per_minute');
  if (!(await checkMinuteRateLimit(`skill-gen:${session.user.id}`, rateLimit))) {
    return jsonError("Слишком много запросов", 429);
  }

  const { description, jurisdiction, category } = await req.json();

  if (!description?.trim() || description.length > AI_GENERATION_DESCRIPTION_MAX_LENGTH) {
    return jsonError("Описание обязательно (макс. 5000 символов)", 400);
  }

  const validCategory = category && VALID_CATEGORY_VALUES.includes(category)
    ? category
    : undefined;

  try {
    let userMsg = jurisdiction
      ? `Создай скилл: ${description.trim()}. Юрисдикция: ${jurisdiction}`
      : `Создай скилл: ${description.trim()}`;

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

    // Validate systemPrompt is focused and not too long
    const systemPrompt = (String(parsed.systemPrompt || "")).slice(0, 4000);

    // Resolve category: prefer user-provided, then AI-generated, then default
    const resolvedCategory = validCategory
      || (VALID_CATEGORY_VALUES.includes(parsed.category as typeof VALID_CATEGORY_VALUES[number]) ? parsed.category : "CUSTOM");

    // Parse tags from AI response
    const resolvedTags = Array.isArray(parsed.tags)
      ? parsed.tags.filter((t: unknown) => typeof t === "string" && (t as string).length <= 50).slice(0, 20)
      : [];

    const result = {
      name: parsed.name || "Новый скилл",
      description: parsed.description || "",
      systemPrompt,
      citationRules: parsed.citationRules || "",
      jurisdiction: JURISDICTIONS.includes(parsed.jurisdiction as typeof JURISDICTIONS[number]) ? parsed.jurisdiction : "RU",
      icon: VALID_ICONS.includes(parsed.icon as string) ? parsed.icon : "Scale",
      iconColor: VALID_COLORS.includes(parsed.iconColor as string) ? parsed.iconColor : DEFAULT_ICON_COLOR,
      category: resolvedCategory,
      tags: resolvedTags,
    };

    return jsonOk(result);
  } catch (e) {
    if (e instanceof LlmModelUnavailableError) {
      return jsonError("Модель не настроена", 503);
    }
    if (e instanceof LlmJsonParseError) {
      return jsonError("Модель вернула некорректный JSON. Попробуйте переформулировать описание скилла.", 422);
    }
    console.error("Skill generation error:", e);
    return jsonError("Ошибка генерации скилла. Попробуйте ещё раз.", 500);
  }
}
