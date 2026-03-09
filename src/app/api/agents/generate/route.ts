import { auth } from "@/lib/auth";
import { jsonOk, jsonError } from "@/lib/api-helpers";
import { resolveModel } from "@/lib/model-router";
import { checkMinuteRateLimit } from "@/lib/rate-limit";
import { getSettingNumber } from "@/lib/settings";
import {
  VALID_ICONS, VALID_COLORS,
  DEFAULT_TEMPERATURE, DEFAULT_MAX_TOKENS_GENERATE, DEFAULT_ICON_COLOR,
} from "@/lib/constants";
import { getPrompt, interpolatePrompt } from "@/lib/prompts";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return jsonError("Unauthorized", 401);
  }

  const rateLimit = await getSettingNumber('rate_agent_gen_per_minute');
  if (!(await checkMinuteRateLimit(`agent-gen:${session.user.id}`, rateLimit))) {
    return jsonError("Слишком много запросов", 429);
  }

  const { description } = await req.json();

  if (!description?.trim() || description.length > 5000) {
    return jsonError("Описание обязательно (макс. 5000 символов)", 400);
  }

  try {
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
          { role: "system", content: interpolatePrompt(await getPrompt("prompt_gen_agent"), {
            VALID_ICONS: VALID_ICONS.join(", "),
            VALID_COLORS: VALID_COLORS.join(", "),
          }) },
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

    return jsonOk(result);
  } catch (e) {
    console.error("Agent generation error:", e);
    return jsonError("Ошибка генерации агента", 500);
  }
}
