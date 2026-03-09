import { auth } from "@/lib/auth";
import { jsonOk, jsonError } from "@/lib/api-helpers";
import { checkMinuteRateLimit } from "@/lib/rate-limit";
import { getSettingNumber } from "@/lib/settings";
import {
  VALID_ICONS, VALID_COLORS, DEFAULT_ICON_COLOR,
  AI_GENERATION_DESCRIPTION_MAX_LENGTH,
} from "@/lib/constants";
import { getPrompt, interpolatePrompt } from "@/lib/prompts";
import {
  callLlmForJson,
  LlmModelUnavailableError,
  LlmJsonParseError,
} from "@/lib/llm-generate";

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

  if (!description?.trim() || description.length > AI_GENERATION_DESCRIPTION_MAX_LENGTH) {
    return jsonError("Описание обязательно (макс. 5000 символов)", 400);
  }

  try {
    const systemContent = interpolatePrompt(await getPrompt("prompt_gen_agent"), {
      VALID_ICONS: VALID_ICONS.join(", "),
      VALID_COLORS: VALID_COLORS.join(", "),
    });

    const parsed = await callLlmForJson<Record<string, unknown>>(
      [
        { role: "system", content: systemContent },
        { role: "user", content: `Создай агента: ${description.trim()}` },
      ],
    );

    const result = {
      name: parsed.name || "Новый агент",
      description: parsed.description || "",
      instructions: parsed.instructions || "",
      icon: VALID_ICONS.includes(parsed.icon as string) ? parsed.icon : "Bot",
      iconColor: VALID_COLORS.includes(parsed.iconColor as string) ? parsed.iconColor : DEFAULT_ICON_COLOR,
    };

    return jsonOk(result);
  } catch (e) {
    if (e instanceof LlmModelUnavailableError) {
      return jsonError("Модель не настроена", 503);
    }
    if (e instanceof LlmJsonParseError) {
      return jsonError("Модель вернула некорректный JSON. Попробуйте переформулировать.", 422);
    }
    console.error("Agent generation error:", e);
    return jsonError("Ошибка генерации агента", 500);
  }
}
