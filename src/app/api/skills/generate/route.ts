import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { resolveModel } from "@/lib/model-router";
import { checkMinuteRateLimit } from "@/lib/rate-limit";
import {
  VALID_ICONS, VALID_COLORS,
  DEFAULT_TEMPERATURE, DEFAULT_MAX_TOKENS_GENERATE, DEFAULT_ICON_COLOR,
} from "@/lib/constants";
import { getPrompt, interpolatePrompt } from "@/lib/prompts";

const JURISDICTIONS = ["RU", "KZ", "BY", "EU", "EU/RU", "International"];

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
          { role: "system", content: interpolatePrompt(await getPrompt("prompt_gen_skill"), {
            VALID_ICONS: VALID_ICONS.join(", "),
            VALID_COLORS: VALID_COLORS.join(", "),
            JURISDICTIONS: JURISDICTIONS.join(", "),
          }) },
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
      // Fallback: find first { to last } when no markdown code block
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
      console.error("Skill generation: failed to parse JSON from response:", content.slice(0, 500));
      return NextResponse.json(
        { error: "Модель вернула некорректный JSON. Попробуйте переформулировать описание скилла." },
        { status: 422 }
      );
    }

    // Validate systemPrompt is focused and not too long
    const systemPrompt = (parsed.systemPrompt || "").slice(0, 4000);

    const result = {
      name: parsed.name || "Новый скилл",
      description: parsed.description || "",
      systemPrompt,
      citationRules: parsed.citationRules || "",
      jurisdiction: JURISDICTIONS.includes(parsed.jurisdiction) ? parsed.jurisdiction : "RU",
      icon: VALID_ICONS.includes(parsed.icon) ? parsed.icon : "Scale",
      iconColor: VALID_COLORS.includes(parsed.iconColor) ? parsed.iconColor : DEFAULT_ICON_COLOR,
    };

    return NextResponse.json(result);
  } catch (e) {
    console.error("Skill generation error:", e);
    return NextResponse.json(
      { error: "Ошибка генерации скилла. Попробуйте ещё раз." },
      { status: 500 }
    );
  }
}
