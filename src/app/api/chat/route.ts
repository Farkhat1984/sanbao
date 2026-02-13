import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserPlanAndUsage, incrementUsage } from "@/lib/usage";
import { checkMinuteRateLimit } from "@/lib/rate-limit";

const SYSTEM_PROMPT = `Ты — Leema, профессиональный юридический AI-ассистент. Ты работаешь с нормативно-правовыми актами, понимаешь связи между статьями, проверяешь актуальность и помогаешь создавать юридические документы.

Твои ключевые навыки:
- Анализ и интерпретация НПА
- Создание договоров, исков, жалоб
- Проверка актуальности статей
- Юридические консультации
- Понимание связей между нормативными актами

При ответе:
- Ссылайся на конкретные статьи законов
- Указывай актуальность нормы
- Используй понятный язык, избегая лишнего юридического жаргона
- Предупреждай о рисках и ограничениях
- Всегда напоминай что финальное решение должен принимать квалифицированный юрист`;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { messages, provider = "openai" } = await req.json();

  const { plan, usage } = await getUserPlanAndUsage(session.user.id);
  if (!plan) {
    return NextResponse.json(
      { error: "Нет настроенного тарифа" },
      { status: 500 }
    );
  }

  // Check daily message limit (0 = unlimited)
  if (
    plan.messagesPerDay > 0 &&
    (usage?.messageCount ?? 0) >= plan.messagesPerDay
  ) {
    return NextResponse.json(
      {
        error: "Достигнут дневной лимит сообщений",
        limit: plan.messagesPerDay,
      },
      { status: 429 }
    );
  }

  // Check per-minute rate limit
  if (!checkMinuteRateLimit(session.user.id, plan.requestsPerMinute)) {
    return NextResponse.json(
      { error: "Слишком много запросов. Подождите минуту." },
      { status: 429 }
    );
  }

  const canUseProvider = plan.canChooseProvider || provider === "openai";
  const model =
    canUseProvider && provider === "anthropic"
      ? anthropic("claude-sonnet-4-5-20250929")
      : openai("gpt-4o");

  const result = streamText({
    model,
    system: SYSTEM_PROMPT,
    messages,
    maxOutputTokens: plan.tokensPerMessage,
  });

  // Track usage
  await incrementUsage(session.user.id, plan.tokensPerMessage);

  return result.toTextStreamResponse();
}
