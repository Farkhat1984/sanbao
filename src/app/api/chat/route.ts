import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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

const MOONSHOT_URL = "https://api.moonshot.ai/v1/chat/completions";

// ─── Web Search ──────────────────────────────────────────

async function executeWebSearch(query: string): Promise<string> {
  try {
    const response = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
    );
    const data = await response.json();
    let results = "";

    if (data.Abstract) {
      results += `**${data.AbstractSource}:** ${data.Abstract}\n\n`;
    }
    if (data.Answer) {
      results += `**Ответ:** ${data.Answer}\n\n`;
    }
    if (data.RelatedTopics?.length > 0) {
      results += "**Связанные результаты:**\n";
      for (const topic of data.RelatedTopics.slice(0, 8)) {
        if (topic.Text) {
          results += `- ${topic.Text}${topic.FirstURL ? ` (${topic.FirstURL})` : ""}\n`;
        }
        if (topic.Topics) {
          for (const sub of topic.Topics.slice(0, 3)) {
            if (sub.Text) {
              results += `  - ${sub.Text}${sub.FirstURL ? ` (${sub.FirstURL})` : ""}\n`;
            }
          }
        }
      }
    }

    return results || "По данному запросу не найдено конкретных результатов. Используй свои знания для ответа.";
  } catch {
    return "Поиск временно недоступен. Ответь на основе своих знаний.";
  }
}

const WEB_SEARCH_TOOL_DEF = {
  type: "function" as const,
  function: {
    name: "web_search",
    description:
      "Search the web for current information. Use this to find current legal news, court decisions, law amendments, regulatory changes, and other up-to-date information.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "The search query" },
      },
      required: ["query"],
    },
  },
};

// ─── SSE Parser ──────────────────────────────────────────

async function* parseSSEStream(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop()!;

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("data: ") && trimmed !== "data: [DONE]") {
          try {
            yield JSON.parse(trimmed.slice(6));
          } catch {
            // Skip malformed JSON
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ─── Attachment types ────────────────────────────────────

interface ChatAttachment {
  name: string;
  type: string;
  base64?: string;
  textContent?: string;
}

// ─── Process messages with attachments ───────────────────

function buildApiMessages(
  messages: Array<{ role: string; content: string }>,
  attachments: ChatAttachment[],
  systemPrompt: string
) {
  const apiMessages: Array<Record<string, unknown>> = [
    { role: "system", content: systemPrompt },
  ];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    // Only attach files to the last user message
    if (i === messages.length - 1 && msg.role === "user" && attachments.length > 0) {
      const imageAttachments = attachments.filter((a) => a.type?.startsWith("image/"));
      const textAttachments = attachments.filter((a) => !a.type?.startsWith("image/"));

      let textContent = msg.content;

      // Prepend text file contents
      if (textAttachments.length > 0) {
        const textParts = textAttachments
          .map((a) => `--- Файл: ${a.name} ---\n${a.textContent}`)
          .join("\n\n");
        textContent = `${textParts}\n\n${textContent}`;
      }

      // If there are images, use multimodal format
      if (imageAttachments.length > 0) {
        const content: Array<Record<string, unknown>> = [];
        for (const img of imageAttachments) {
          content.push({
            type: "image_url",
            image_url: { url: `data:${img.type};base64,${img.base64}` },
          });
        }
        content.push({ type: "text", text: textContent });
        apiMessages.push({ role: msg.role, content });
      } else {
        apiMessages.push({ role: msg.role, content: textContent });
      }
    } else {
      apiMessages.push(msg);
    }
  }

  return apiMessages;
}

// ─── Moonshot (Kimi K2.5) streaming handler ─────────────

function streamMoonshot(
  apiMessages: Array<Record<string, unknown>>,
  options: {
    maxTokens: number;
    thinkingEnabled: boolean;
    webSearchEnabled: boolean;
  }
) {
  const encoder = new TextEncoder();
  const { maxTokens, thinkingEnabled, webSearchEnabled } = options;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const maxSteps = webSearchEnabled ? 5 : 1;

        for (let step = 0; step < maxSteps; step++) {
          const response = await fetch(MOONSHOT_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.MOONSHOT_API_KEY}`,
            },
            body: JSON.stringify({
              model: "kimi-k2.5",
              messages: apiMessages,
              max_tokens: maxTokens,
              temperature: thinkingEnabled ? 1.0 : 0.6,
              top_p: 0.95,
              stream: true,
              ...(webSearchEnabled ? { tools: [WEB_SEARCH_TOOL_DEF] } : {}),
              ...(!thinkingEnabled
                ? { thinking: { type: "disabled" } }
                : {}),
            }),
          });

          if (!response.ok) {
            const errText = await response.text().catch(() => "Unknown error");
            let errMsg = `Ошибка API: ${response.status}`;
            try {
              const errJson = JSON.parse(errText);
              errMsg = errJson.error?.message || errMsg;
            } catch {
              // use default
            }
            controller.enqueue(
              encoder.encode(JSON.stringify({ t: "e", v: errMsg }) + "\n")
            );
            break;
          }

          if (!response.body) {
            controller.enqueue(
              encoder.encode(
                JSON.stringify({ t: "e", v: "Пустой ответ от API" }) + "\n"
              )
            );
            break;
          }

          // Parse SSE stream
          const toolCalls: Record<
            number,
            { id: string; name: string; arguments: string }
          > = {};
          let hasToolCalls = false;
          let assistantContent = "";

          for await (const chunk of parseSSEStream(response.body)) {
            const choice = chunk.choices?.[0];
            if (!choice) continue;

            const delta = choice.delta;

            // Stream reasoning (only if thinking enabled)
            if (thinkingEnabled && delta?.reasoning_content) {
              controller.enqueue(
                encoder.encode(
                  JSON.stringify({ t: "r", v: delta.reasoning_content }) + "\n"
                )
              );
            }

            // Stream content
            if (delta?.content) {
              assistantContent += delta.content;
              controller.enqueue(
                encoder.encode(
                  JSON.stringify({ t: "c", v: delta.content }) + "\n"
                )
              );
            }

            // Accumulate tool calls
            if (delta?.tool_calls) {
              hasToolCalls = true;
              for (const tc of delta.tool_calls) {
                const idx = tc.index ?? 0;
                if (!toolCalls[idx]) {
                  toolCalls[idx] = { id: "", name: "", arguments: "" };
                }
                if (tc.id) toolCalls[idx].id = tc.id;
                if (tc.function?.name) toolCalls[idx].name += tc.function.name;
                if (tc.function?.arguments)
                  toolCalls[idx].arguments += tc.function.arguments;
              }
            }
          }

          // If no tool calls, we're done
          if (!hasToolCalls) break;

          // Execute tool calls
          const toolCallsArray = Object.values(toolCalls).map((tc) => ({
            id: tc.id,
            type: "function" as const,
            function: { name: tc.name, arguments: tc.arguments },
          }));

          apiMessages.push({
            role: "assistant",
            content: assistantContent || null,
            tool_calls: toolCallsArray,
          });

          for (const tc of Object.values(toolCalls)) {
            if (tc.name === "web_search") {
              try {
                const args = JSON.parse(tc.arguments);
                controller.enqueue(
                  encoder.encode(
                    JSON.stringify({ t: "s", v: args.query }) + "\n"
                  )
                );
                const result = await executeWebSearch(args.query);
                apiMessages.push({
                  role: "tool",
                  tool_call_id: tc.id,
                  content: result,
                });
              } catch {
                apiMessages.push({
                  role: "tool",
                  tool_call_id: tc.id,
                  content: "Ошибка выполнения поиска.",
                });
              }
            }
          }
        }
      } catch {
        controller.enqueue(
          encoder.encode(
            JSON.stringify({ t: "e", v: "Ошибка подключения к API" }) + "\n"
          )
        );
      } finally {
        controller.close();
      }
    },
  });

  return stream;
}

// ─── Main handler ────────────────────────────────────────

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const {
    messages,
    provider = "deepinfra",
    agentId,
    thinkingEnabled = true,
    webSearchEnabled = false,
    attachments = [],
  } = await req.json();

  const { plan, usage } = await getUserPlanAndUsage(session.user.id);
  if (!plan) {
    return NextResponse.json(
      { error: "Нет настроенного тарифа" },
      { status: 500 }
    );
  }

  if (
    plan.messagesPerDay > 0 &&
    (usage?.messageCount ?? 0) >= plan.messagesPerDay
  ) {
    return NextResponse.json(
      { error: "Достигнут дневной лимит сообщений", limit: plan.messagesPerDay },
      { status: 429 }
    );
  }

  if (!checkMinuteRateLimit(session.user.id, plan.requestsPerMinute)) {
    return NextResponse.json(
      { error: "Слишком много запросов. Подождите минуту." },
      { status: 429 }
    );
  }

  // Build system prompt and determine provider
  let systemPrompt = SYSTEM_PROMPT;
  let effectiveProvider = provider;

  if (agentId) {
    const agent = await prisma.agent.findFirst({
      where: { id: agentId, userId: session.user.id },
      include: {
        files: { select: { extractedText: true, fileName: true } },
      },
    });

    if (agent) {
      effectiveProvider = agent.model;

      const filesContext = agent.files
        .filter((f) => f.extractedText)
        .map((f) => `--- Файл: ${f.fileName} ---\n${f.extractedText}`)
        .join("\n\n");

      systemPrompt = `${agent.instructions}\n\n${SYSTEM_PROMPT}`;

      if (filesContext) {
        systemPrompt += `\n\n--- Контекст из загруженных файлов ---\n${filesContext}`;
      }
    }
  }

  if (webSearchEnabled) {
    systemPrompt +=
      "\n\nУ тебя есть доступ к веб-поиску. Используй инструмент web_search когда нужно найти актуальную информацию, последние изменения в законодательстве, судебную практику или новости.";
  }

  // Process messages
  const apiMessages = buildApiMessages(messages, attachments, systemPrompt);

  // Track usage
  await incrementUsage(session.user.id, plan.tokensPerMessage);

  // ─── Moonshot (Kimi K2.5) ──────────────────────────────
  if (effectiveProvider === "deepinfra") {
    const stream = streamMoonshot(apiMessages, {
      maxTokens: plan.tokensPerMessage,
      thinkingEnabled,
      webSearchEnabled,
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  }

  // ─── Other providers (OpenAI, Anthropic via AI SDK) ─────
  const canUseProvider =
    plan.canChooseProvider || effectiveProvider === "openai";

  let model;
  if (canUseProvider && effectiveProvider === "anthropic") {
    model = anthropic("claude-sonnet-4-5-20250929");
  } else {
    model = openai("gpt-4o");
  }

  const result = streamText({
    model,
    system: systemPrompt,
    messages,
    temperature: 0.6,
    topP: 0.95,
    maxOutputTokens: plan.tokensPerMessage,
  });

  // Wrap AI SDK text stream in NDJSON format
  const encoder = new TextEncoder();
  const textStream = result.textStream;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of textStream) {
          if (chunk) {
            controller.enqueue(
              encoder.encode(JSON.stringify({ t: "c", v: chunk }) + "\n")
            );
          }
        }
      } catch {
        controller.enqueue(
          encoder.encode(
            JSON.stringify({ t: "e", v: "Ошибка генерации ответа" }) + "\n"
          )
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
