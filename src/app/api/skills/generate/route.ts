import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { resolveModel } from "@/lib/model-router";
import { checkMinuteRateLimit } from "@/lib/rate-limit";
import {
  VALID_ICONS, VALID_COLORS,
  DEFAULT_TEMPERATURE, DEFAULT_MAX_TOKENS_GENERATE, DEFAULT_ICON_COLOR,
} from "@/lib/constants";

const JURISDICTIONS = ["RU", "KZ", "BY", "EU", "EU/RU", "International"];

const SYSTEM_GEN_PROMPT = `Ты — мета-промпт-инженер, специализирующийся на создании юридических скиллов для AI-ассистента.

Ты должен вернуть JSON-объект с полями:
- "name": название скилла (2-4 слова, на русском)
- "description": краткое описание (1 предложение, на русском)
- "systemPrompt": детальный системный промпт (на русском, 200-600 слов)
- "citationRules": правила цитирования НПА (на русском, 50-150 слов)
- "jurisdiction": одна из: ${JURISDICTIONS.join(", ")}
- "icon": одна из иконок: ${VALID_ICONS.join(", ")}
- "iconColor": один из цветов: ${VALID_COLORS.join(", ")}

Правила для systemPrompt:
1. Определи роль и специализацию
2. Укажи ключевые НПА и источники права для этой области
3. Опиши методологию анализа
4. Формат ответа: структура, уровень детализации
5. Ограничения: что скилл НЕ покрывает

Правила для citationRules:
1. Формат ссылок на НПА (статья, пункт, подпункт)
2. Приоритет источников
3. Как обозначать актуальность нормы

ВАЖНО: Ответ ТОЛЬКО в формате JSON, без markdown-обёртки.`;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit: 10 requests/minute per user
  if (!(await checkMinuteRateLimit(`skill-gen:${session.user.id}`, 10))) {
    return NextResponse.json({ error: "Слишком много запросов" }, { status: 429 });
  }

  const { description, jurisdiction } = await req.json();

  if (!description?.trim() || description.length > 5000) {
    return NextResponse.json({ error: "Описание обязательно (макс. 5000 символов)" }, { status: 400 });
  }

  try {
    const userMsg = jurisdiction
      ? `Создай скилл: ${description.trim()}. Юрисдикция: ${jurisdiction}`
      : `Создай скилл: ${description.trim()}`;

    const textModel = await resolveModel("TEXT");
    if (!textModel) {
      return NextResponse.json({ error: "Модель не настроена" }, { status: 503 });
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
          { role: "system", content: SYSTEM_GEN_PROMPT },
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
    }

    const parsed = JSON.parse(jsonStr);

    const result = {
      name: parsed.name || "Новый скилл",
      description: parsed.description || "",
      systemPrompt: parsed.systemPrompt || "",
      citationRules: parsed.citationRules || "",
      jurisdiction: JURISDICTIONS.includes(parsed.jurisdiction) ? parsed.jurisdiction : "RU",
      icon: VALID_ICONS.includes(parsed.icon) ? parsed.icon : "Scale",
      iconColor: VALID_COLORS.includes(parsed.iconColor) ? parsed.iconColor : DEFAULT_ICON_COLOR,
    };

    return NextResponse.json(result);
  } catch (e) {
    console.error("Skill generation error:", e);
    return NextResponse.json(
      { error: "Ошибка генерации скилла" },
      { status: 500 }
    );
  }
}
