import { requireAuth, jsonOk, jsonError, serializeDates } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { resolveModel } from "@/lib/model-router";
import { checkMinuteRateLimit } from "@/lib/rate-limit";
import { getSettingNumber } from "@/lib/settings";
import { getPrompt, interpolatePrompt } from "@/lib/prompts";
import {
  VALID_ICONS, VALID_COLORS, SKILL_CATEGORIES,
  DEFAULT_TEMPERATURE, DEFAULT_MAX_TOKENS_GENERATE,
  DEFAULT_ICON_COLOR, DEFAULT_SKILL_ICON,
} from "@/lib/constants";

const JURISDICTIONS = ["RU", "KZ", "BY", "EU", "EU/RU", "International"];
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

  if (!description?.trim() || description.length > 5000) {
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

    const textModel = await resolveModel("TEXT");
    if (!textModel) {
      return jsonError("Модель не настроена", 503);
    }

    const apiUrl = `${textModel.provider.baseUrl}/chat/completions`;
    const apiKey = textModel.provider.apiKey;
    const modelId = textModel.modelId;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          {
            role: "system",
            content: interpolatePrompt(await getPrompt("prompt_gen_skill"), {
              VALID_ICONS: VALID_ICONS.join(", "),
              VALID_COLORS: VALID_COLORS.join(", "),
              JURISDICTIONS: JURISDICTIONS.join(", "),
              CATEGORIES: VALID_CATEGORY_VALUES.join(", "),
            }),
          },
          { role: "user", content: userMsg },
        ],
        temperature: textModel?.temperature ?? DEFAULT_TEMPERATURE,
        max_tokens: textModel?.maxTokens || DEFAULT_MAX_TOKENS_GENERATE,
        stream: false,
        thinking: { type: "disabled" },
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error("AI API error:", response.status, errText);
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("Empty response");
    }

    // Extract JSON from response (may be wrapped in ```json ... ```)
    let jsonStr = content.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    } else {
      const start = jsonStr.indexOf("{");
      const end = jsonStr.lastIndexOf("}");
      if (start >= 0 && end > start) {
        jsonStr = jsonStr.slice(start, end + 1);
      }
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error("Quick-create: failed to parse JSON:", content.slice(0, 500));
      return jsonError("Модель вернула некорректный JSON. Попробуйте переформулировать.", 422);
    }

    // Validate and sanitize AI output
    const systemPrompt = (parsed.systemPrompt || "").slice(0, 4000);
    const resolvedCategory = validCategory
      || (VALID_CATEGORY_VALUES.includes(parsed.category) ? parsed.category : "CUSTOM");
    const resolvedTags = Array.isArray(parsed.tags)
      ? parsed.tags.filter((t: unknown) => typeof t === "string" && t.length <= 50).slice(0, 20)
      : [];

    const skill = await prisma.skill.create({
      data: {
        userId,
        name: parsed.name || "Новый скилл",
        description: parsed.description || "",
        systemPrompt,
        citationRules: parsed.citationRules || "",
        jurisdiction: JURISDICTIONS.includes(parsed.jurisdiction) ? parsed.jurisdiction : "RU",
        icon: VALID_ICONS.includes(parsed.icon) ? parsed.icon : DEFAULT_SKILL_ICON,
        iconColor: VALID_COLORS.includes(parsed.iconColor) ? parsed.iconColor : DEFAULT_ICON_COLOR,
        category: resolvedCategory,
        tags: resolvedTags,
      },
    });

    return jsonOk(serializeDates(skill), 201);
  } catch (e) {
    console.error("Quick-create error:", e);
    return jsonError("Ошибка генерации скилла. Попробуйте ещё раз.", 500);
  }
}
