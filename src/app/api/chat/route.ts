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

// ─── Moonshot built-in web search tool ───────────────────

const WEB_SEARCH_BUILTIN = {
  type: "builtin_function" as const,
  function: { name: "$web_search" },
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
        const currentMessages = [...apiMessages];
        let searchNotified = false;

        // Tool-call loop: max 3 iterations to prevent infinite loops
        for (let turn = 0; turn < 3; turn++) {
          const response = await fetch(MOONSHOT_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.MOONSHOT_API_KEY}`,
            },
            body: JSON.stringify({
              model: "kimi-k2.5",
              messages: currentMessages,
              max_tokens: maxTokens,
              temperature: thinkingEnabled ? 1.0 : 0.6,
              top_p: 0.95,
              stream: true,
              ...(webSearchEnabled
                ? { tools: [WEB_SEARCH_BUILTIN] }
                : {}),
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
            return;
          }

          if (!response.body) {
            controller.enqueue(
              encoder.encode(
                JSON.stringify({ t: "e", v: "Пустой ответ от API" }) + "\n"
              )
            );
            return;
          }

          // Collect tool calls from this turn
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const toolCallMap: Record<number, { id: string; type: string; function: { name: string; arguments: string } }> = {};
          let hasToolCallFinish = false;

          for await (const chunk of parseSSEStream(response.body)) {
            const choice = chunk.choices?.[0];
            if (!choice) continue;

            const delta = choice.delta;

            // Accumulate tool_calls (streamed in parts)
            if (delta?.tool_calls) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              for (const tc of delta.tool_calls as any[]) {
                const idx = tc.index ?? 0;
                if (tc.id) {
                  // First chunk of this tool call
                  toolCallMap[idx] = {
                    id: tc.id,
                    type: tc.type || "builtin_function",
                    function: {
                      name: tc.function?.name || "",
                      arguments: tc.function?.arguments || "",
                    },
                  };
                } else if (tc.function?.arguments && toolCallMap[idx]) {
                  // Continuation — append arguments
                  toolCallMap[idx].function.arguments += tc.function.arguments;
                }
              }

              // Notify frontend about search
              if (!searchNotified) {
                searchNotified = true;
                controller.enqueue(
                  encoder.encode(
                    JSON.stringify({ t: "s", v: "searching" }) + "\n"
                  )
                );
              }
            }

            if (choice.finish_reason === "tool_calls") {
              hasToolCallFinish = true;
            }

            // Stream reasoning + content to frontend
            if (thinkingEnabled && delta?.reasoning_content) {
              controller.enqueue(
                encoder.encode(
                  JSON.stringify({ t: "r", v: delta.reasoning_content }) + "\n"
                )
              );
            }

            if (delta?.content) {
              controller.enqueue(
                encoder.encode(
                  JSON.stringify({ t: "c", v: delta.content }) + "\n"
                )
              );
            }
          }

          // If model finished with tool_calls, send results back and loop
          const collectedCalls = Object.values(toolCallMap);
          if (hasToolCallFinish && collectedCalls.length > 0) {
            // Add assistant message with tool_calls
            currentMessages.push({
              role: "assistant",
              tool_calls: collectedCalls,
            });

            // Add tool result messages
            for (const tc of collectedCalls) {
              currentMessages.push({
                role: "tool",
                tool_call_id: tc.id,
                content: tc.function.arguments,
              });
            }

            // Continue to next iteration (second API call)
            continue;
          }

          // No tool calls — we're done
          break;
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
      "\n\nУ тебя есть доступ к веб-поиску. Используй его когда нужно найти актуальную информацию, последние изменения в законодательстве, судебную практику или новости.";
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
