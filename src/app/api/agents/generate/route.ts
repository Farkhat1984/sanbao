import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { resolveModel } from "@/lib/model-router";
import { checkMinuteRateLimit } from "@/lib/rate-limit";
import {
  VALID_ICONS, VALID_COLORS,
  DEFAULT_TEMPERATURE, DEFAULT_MAX_TOKENS_GENERATE, DEFAULT_ICON_COLOR,
} from "@/lib/constants";

const SYSTEM_GEN_PROMPT = `Ты — мета-промпт-инженер. Твоя задача — создать профессионального AI-агента на основе описания пользователя.

Ты должен вернуть JSON-объект с полями:
- "name": короткое название агента (2-5 слов, на русском)
- "description": краткое описание для карточки (1-2 предложения, на русском)
- "instructions": детальный системный промпт для агента (на русском, 300-800 слов)
- "icon": одна из иконок: ${VALID_ICONS.join(", ")}
- "iconColor": один из цветов: ${VALID_COLORS.join(", ")}

Правила для instructions:
1. Начни с определения роли: "Ты — [роль]. Твоя специализация — ..."
2. Опиши ключевые компетенции и области знаний
3. Укажи формат и стиль ответов (структурированность, тон, длина)
4. Добавь ограничения: чего агент НЕ должен делать
5. Включи примеры типичных задач, которые агент решает
6. Если это юридический агент — укажи юрисдикцию и основные НПА

Выбирай icon и iconColor, наиболее подходящие к тематике агента.

ВАЖНО: Ответ ТОЛЬКО в формате JSON, без markdown-обёртки.`;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit: 10 requests/minute per user
  if (!(await checkMinuteRateLimit(`agent-gen:${session.user.id}`, 10))) {
    return NextResponse.json({ error: "Слишком много запросов" }, { status: 429 });
  }

  const { description } = await req.json();

  if (!description?.trim() || description.length > 5000) {
    return NextResponse.json({ error: "Описание обязательно (макс. 5000 символов)" }, { status: 400 });
  }

  try {
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
          { role: "user", content: `Создай агента: ${description.trim()}` },
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

    // Validate and fallback
    const result = {
      name: parsed.name || "Новый агент",
      description: parsed.description || "",
      instructions: parsed.instructions || "",
      icon: VALID_ICONS.includes(parsed.icon) ? parsed.icon : "Bot",
      iconColor: VALID_COLORS.includes(parsed.iconColor) ? parsed.iconColor : DEFAULT_ICON_COLOR,
    };

    return NextResponse.json(result);
  } catch (e) {
    console.error("Agent generation error:", e);
    return NextResponse.json(
      { error: "Ошибка генерации агента" },
      { status: 500 }
    );
  }
}
