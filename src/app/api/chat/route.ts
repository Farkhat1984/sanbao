import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";

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
  const { messages, provider = "openai" } = await req.json();

  const model =
    provider === "anthropic"
      ? anthropic("claude-sonnet-4-5-20250929")
      : openai("gpt-4o");

  const result = streamText({
    model,
    system: SYSTEM_PROMPT,
    messages,
  });

  return result.toTextStreamResponse();
}
