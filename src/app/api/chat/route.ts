import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserPlanAndUsage, incrementUsage, incrementTokens } from "@/lib/usage";
import { checkMinuteRateLimit } from "@/lib/rate-limit";
import {
  estimateTokens,
  checkContextWindow,
  splitMessagesForCompaction,
  buildCompactionPrompt,
  buildSystemPromptWithContext,
} from "@/lib/context";
import { buildMemoryContext } from "@/lib/memory";
import { FEMIDA_ID, FEMIDA_SYSTEM_PROMPT, isSystemAgent } from "@/lib/system-agents";

const SYSTEM_PROMPT = `Ты — Leema, универсальный AI-ассистент. Отвечай точно, полезно и по делу.

СОЗДАНИЕ ДОКУМЕНТОВ:
Когда создаёшь документ, текст, код или структурированный контент, оберни содержимое в теги:
<leema-doc type="ТИП" title="Название">
Содержимое в формате Markdown
</leema-doc>

Доступные типы: DOCUMENT, CODE, ANALYSIS.
Используй структурированный Markdown: заголовки (#, ##, ###), списки, таблицы, **жирный** для ключевых терминов.

Используй <leema-doc> когда пользователь просит создать, написать, составить, сгенерировать что-то объёмное.
НЕ используй для коротких ответов, простых вопросов или фрагментов кода менее 10 строк.

РЕДАКТИРОВАНИЕ ДОКУМЕНТОВ:
Когда пользователь просит изменить, доработать или исправить ранее созданный документ, используй тег <leema-edit> с точечными заменами вместо полной перегенерации:

<leema-edit target="Точное название документа">
<replace>
<old>точный фрагмент текста который нужно заменить</old>
<new>новый текст на замену</new>
</replace>
</leema-edit>

Правила:
- target — точное название документа из предыдущего <leema-doc title="...">
- <old> — точная копия фрагмента из документа (включая форматирование)
- <new> — новый текст на замену
- Можно указать несколько <replace> блоков для нескольких изменений
- Кратко опиши что изменил до или после тега
- Используй <leema-edit> ТОЛЬКО если документ уже был создан ранее в этом чате
- Если нужно создать документ с нуля — используй <leema-doc>

РЕЖИМ ПЛАНИРОВАНИЯ:
Для сложных запросов можешь начать с плана:
<leema-plan>
## План
1. Шаг первый
2. Шаг второй
</leema-plan>

ЗАДАЧИ:
Для многошаговых запросов (3+ шагов) создавай чек-лист:
<leema-task title="Название задачи">
- [ ] Первый шаг
- [ ] Второй шаг
</leema-task>

УТОЧНЯЮЩИЕ ВОПРОСЫ:
Когда пользователь просит создать документ (иск, договор, жалобу, заявление и т.д.), но не указал достаточно деталей — ПЕРЕД созданием документа задай уточняющие вопросы в специальном теге. Дай краткие рекомендации по теме, а затем добавь тег в конце сообщения:

<leema-clarify>
[
  {"id": "1", "question": "Текст вопроса?", "options": ["Вариант 1", "Вариант 2", "Вариант 3"]},
  {"id": "2", "question": "Другой вопрос?", "type": "text", "placeholder": "Укажите..."}
]
</leema-clarify>

Правила:
- 2-5 вопросов, каждый с уникальным id
- Для вопросов с вариантами: поле options (2-5 вариантов). Это тип по умолчанию.
- Для свободного ввода: type:"text" и placeholder
- Тег ВСЕГДА в конце сообщения, после текстового ответа
- НЕ используй если пользователь дал достаточно информации для создания документа
- После получения ответов — сразу создавай документ через <leema-doc>`;

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

// ─── Background compaction ───────────────────────────────

async function compactInBackground(
  conversationId: string,
  existingSummary: string | null,
  messagesToSummarize: Array<{ role: string; content: string }>,
  maxTokens: number,
  userId: string
) {
  try {
    const compactionPrompt = buildCompactionPrompt(existingSummary, messagesToSummarize);

    const response = await fetch(MOONSHOT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.MOONSHOT_API_KEY}`,
      },
      body: JSON.stringify({
        model: "kimi-k2.5",
        messages: [
          { role: "system", content: "Ты — ассистент для сжатия контекста разговора." },
          { role: "user", content: compactionPrompt },
        ],
        max_tokens: Math.min(maxTokens, 2048),
        temperature: 0.3,
        stream: false,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const summaryText = data.choices?.[0]?.message?.content;

      if (summaryText) {
        await prisma.conversationSummary.upsert({
          where: { conversationId },
          create: {
            conversationId,
            content: summaryText,
            tokenEstimate: estimateTokens(summaryText),
            messagesCovered: messagesToSummarize.length,
            version: 1,
          },
          update: {
            content: summaryText,
            tokenEstimate: estimateTokens(summaryText),
            messagesCovered: { increment: messagesToSummarize.length },
            version: { increment: 1 },
          },
        });

        const compactionTokens = estimateTokens(compactionPrompt) + estimateTokens(summaryText);
        await incrementTokens(userId, compactionTokens);
      }
    }
  } catch {
    console.error("Compaction failed silently");
  }
}

// ─── Moonshot (Kimi K2.5) streaming handler ─────────────

function streamMoonshot(
  apiMessages: Array<Record<string, unknown>>,
  options: {
    maxTokens: number;
    thinkingEnabled: boolean;
    webSearchEnabled: boolean;
    contextInfo?: { usagePercent: number; totalTokens: number; contextWindowSize: number; compacting: boolean };
  }
) {
  const encoder = new TextEncoder();
  const { maxTokens, thinkingEnabled, webSearchEnabled, contextInfo } = options;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Emit context info as first chunk
        if (contextInfo) {
          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                t: "x",
                v: JSON.stringify({
                  action: "context_info",
                  ...contextInfo,
                }),
              }) + "\n"
            )
          );
        }

        const currentMessages = [...apiMessages];
        let searchNotified = false;

        // Plan detection state
        let insidePlan = false;
        let planBuffer = "";

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
            // Handle SSE error events from Moonshot API
            if (chunk.type === "error" || chunk.error) {
              const errMsg = chunk.error?.message || "Ошибка API провайдера";
              console.error(chunk);
              controller.enqueue(
                encoder.encode(JSON.stringify({ t: "e", v: errMsg }) + "\n")
              );
              return;
            }

            const choice = chunk.choices?.[0];
            if (!choice) continue;

            const delta = choice.delta;

            // Accumulate tool_calls (streamed in parts)
            if (delta?.tool_calls) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              for (const tc of delta.tool_calls as any[]) {
                const idx = tc.index ?? 0;
                if (tc.id) {
                  toolCallMap[idx] = {
                    id: tc.id,
                    type: tc.type || "builtin_function",
                    function: {
                      name: tc.function?.name || "",
                      arguments: tc.function?.arguments || "",
                    },
                  };
                } else if (tc.function?.arguments && toolCallMap[idx]) {
                  toolCallMap[idx].function.arguments += tc.function.arguments;
                }
              }

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

            // Stream reasoning
            if (thinkingEnabled && delta?.reasoning_content) {
              controller.enqueue(
                encoder.encode(
                  JSON.stringify({ t: "r", v: delta.reasoning_content }) + "\n"
                )
              );
            }

            // Stream content with plan detection
            if (delta?.content) {
              planBuffer += delta.content;

              // Check for plan opening tag
              if (!insidePlan && planBuffer.includes("<leema-plan>")) {
                const idx = planBuffer.indexOf("<leema-plan>");
                const before = planBuffer.slice(0, idx);
                if (before) {
                  controller.enqueue(
                    encoder.encode(JSON.stringify({ t: "c", v: before }) + "\n")
                  );
                }
                planBuffer = planBuffer.slice(idx + "<leema-plan>".length);
                insidePlan = true;
              }

              if (insidePlan) {
                // Check for plan closing tag
                if (planBuffer.includes("</leema-plan>")) {
                  const idx = planBuffer.indexOf("</leema-plan>");
                  const planText = planBuffer.slice(0, idx);
                  if (planText) {
                    controller.enqueue(
                      encoder.encode(JSON.stringify({ t: "p", v: planText }) + "\n")
                    );
                  }
                  planBuffer = planBuffer.slice(idx + "</leema-plan>".length);
                  insidePlan = false;
                  // Flush remaining as content
                  if (planBuffer) {
                    controller.enqueue(
                      encoder.encode(JSON.stringify({ t: "c", v: planBuffer }) + "\n")
                    );
                    planBuffer = "";
                  }
                } else if (planBuffer.length > 20) {
                  // Flush accumulated plan content incrementally
                  controller.enqueue(
                    encoder.encode(JSON.stringify({ t: "p", v: planBuffer }) + "\n")
                  );
                  planBuffer = "";
                }
              } else {
                // Not in plan — flush as content
                if (planBuffer) {
                  controller.enqueue(
                    encoder.encode(JSON.stringify({ t: "c", v: planBuffer }) + "\n")
                  );
                  planBuffer = "";
                }
              }
            }
          }

          // Flush remaining plan buffer
          if (planBuffer) {
            const type = insidePlan ? "p" : "c";
            controller.enqueue(
              encoder.encode(JSON.stringify({ t: type, v: planBuffer }) + "\n")
            );
            planBuffer = "";
          }

          // If model finished with tool_calls, send results back and loop
          const collectedCalls = Object.values(toolCallMap);
          if (hasToolCallFinish && collectedCalls.length > 0) {
            currentMessages.push({
              role: "assistant",
              tool_calls: collectedCalls,
            });

            for (const tc of collectedCalls) {
              currentMessages.push({
                role: "tool",
                tool_call_id: tc.id,
                content: tc.function.arguments,
              });
            }

            continue;
          }

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

// ─── Plan detection wrapper for AI SDK streams ──────────

function createPlanDetectorStream(
  textStream: AsyncIterable<string>,
  contextInfo?: { usagePercent: number; totalTokens: number; contextWindowSize: number; compacting: boolean }
): ReadableStream {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        // Emit context info
        if (contextInfo) {
          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                t: "x",
                v: JSON.stringify({ action: "context_info", ...contextInfo }),
              }) + "\n"
            )
          );
        }

        let insidePlan = false;
        let planBuffer = "";

        for await (const chunk of textStream) {
          if (!chunk) continue;

          planBuffer += chunk;

          if (!insidePlan && planBuffer.includes("<leema-plan>")) {
            const idx = planBuffer.indexOf("<leema-plan>");
            const before = planBuffer.slice(0, idx);
            if (before) {
              controller.enqueue(
                encoder.encode(JSON.stringify({ t: "c", v: before }) + "\n")
              );
            }
            planBuffer = planBuffer.slice(idx + "<leema-plan>".length);
            insidePlan = true;
          }

          if (insidePlan) {
            if (planBuffer.includes("</leema-plan>")) {
              const idx = planBuffer.indexOf("</leema-plan>");
              const planText = planBuffer.slice(0, idx);
              if (planText) {
                controller.enqueue(
                  encoder.encode(JSON.stringify({ t: "p", v: planText }) + "\n")
                );
              }
              planBuffer = planBuffer.slice(idx + "</leema-plan>".length);
              insidePlan = false;
              if (planBuffer) {
                controller.enqueue(
                  encoder.encode(JSON.stringify({ t: "c", v: planBuffer }) + "\n")
                );
                planBuffer = "";
              }
            } else if (planBuffer.length > 20) {
              controller.enqueue(
                encoder.encode(JSON.stringify({ t: "p", v: planBuffer }) + "\n")
              );
              planBuffer = "";
            }
          } else {
            if (planBuffer) {
              controller.enqueue(
                encoder.encode(JSON.stringify({ t: "c", v: planBuffer }) + "\n")
              );
              planBuffer = "";
            }
          }
        }

        // Flush remaining
        if (planBuffer) {
          const type = insidePlan ? "p" : "c";
          controller.enqueue(
            encoder.encode(JSON.stringify({ t: type, v: planBuffer }) + "\n")
          );
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
    skillId,
    thinkingEnabled = true,
    webSearchEnabled = false,
    attachments = [],
    conversationId: reqConvId,
  } = await req.json();

  const { plan, usage, monthlyUsage } = await getUserPlanAndUsage(session.user.id);
  if (!plan) {
    return NextResponse.json(
      { error: "Нет настроенного тарифа" },
      { status: 500 }
    );
  }

  // Daily message limit
  if (
    plan.messagesPerDay > 0 &&
    (usage?.messageCount ?? 0) >= plan.messagesPerDay
  ) {
    return NextResponse.json(
      { error: `Достигнут дневной лимит сообщений (${plan.messagesPerDay}). Перейдите на более объёмный тариф для увеличения лимита.`, limit: plan.messagesPerDay },
      { status: 429 }
    );
  }

  // Monthly token limit
  if (
    plan.tokensPerMonth > 0 &&
    monthlyUsage.tokenCount >= plan.tokensPerMonth
  ) {
    return NextResponse.json(
      { error: "Достигнут месячный лимит токенов. Перейдите на более объёмный тариф для продолжения работы.", limit: plan.tokensPerMonth },
      { status: 429 }
    );
  }

  // Minute rate limit
  if (!checkMinuteRateLimit(session.user.id, plan.requestsPerMinute)) {
    return NextResponse.json(
      { error: "Слишком много запросов. Подождите минуту." },
      { status: 429 }
    );
  }

  // Reasoning access check
  if (thinkingEnabled && !plan.canUseReasoning) {
    return NextResponse.json(
      { error: "Режим рассуждений доступен на тарифе Pro и выше. Обновите подписку в настройках." },
      { status: 403 }
    );
  }

  // Web search access check
  if (webSearchEnabled && !plan.canUseAdvancedTools) {
    return NextResponse.json(
      { error: "Веб-поиск доступен на тарифе Pro и выше. Обновите подписку в настройках." },
      { status: 403 }
    );
  }

  // Build system prompt and determine provider
  let systemPrompt = SYSTEM_PROMPT;
  let effectiveProvider = provider;

  if (agentId) {
    if (isSystemAgent(agentId)) {
      // System agent: use hardcoded prompt
      if (agentId === FEMIDA_ID) {
        systemPrompt = `${FEMIDA_SYSTEM_PROMPT}\n\n${SYSTEM_PROMPT}`;
      }
    } else {
      // User-created agent: load from DB
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
  }

  // ─── Load skill ──────────────────────────────────────────

  if (skillId) {
    const skill = await prisma.skill.findFirst({
      where: {
        id: skillId,
        OR: [
          { isBuiltIn: true },
          { userId: session.user.id },
          { isPublic: true },
        ],
      },
    });

    if (skill) {
      let skillPrompt = skill.systemPrompt;
      if (skill.citationRules) {
        skillPrompt += `\n\nПРАВИЛА ЦИТИРОВАНИЯ:\n${skill.citationRules}`;
      }
      if (skill.jurisdiction) {
        skillPrompt += `\n\nЮРИСДИКЦИЯ: ${skill.jurisdiction}`;
      }
      systemPrompt = `${skillPrompt}\n\n${systemPrompt}`;
    }
  }

  if (webSearchEnabled) {
    systemPrompt +=
      "\n\nУ тебя есть доступ к веб-поиску. Используй его когда нужно найти актуальную информацию, последние изменения в законодательстве, судебную практику или новости.\n\nВАЖНО: Когда используешь веб-поиск, ОБЯЗАТЕЛЬНО в конце ответа добавь раздел «Источники:» со списком URL-ссылок откуда была взята информация. Формат:\n\nИсточники:\n- [Название](URL)\n- [Название](URL)";
  }

  // ─── Load context from DB (summary + plan memory + user memory) ──

  let existingSummary: string | null = null;
  let planMemory: string | null = null;
  let userMemoryContext: string | null = null;

  const [contextData, userMemories] = await Promise.all([
    reqConvId
      ? Promise.all([
          prisma.conversationSummary.findUnique({
            where: { conversationId: reqConvId },
          }),
          prisma.conversationPlan.findFirst({
            where: { conversationId: reqConvId, isActive: true },
            orderBy: { createdAt: "desc" },
          }),
        ])
      : Promise.resolve([null, null]),
    prisma.userMemory.findMany({
      where: { userId: session.user.id },
      select: { key: true, content: true },
    }),
  ]);

  if (reqConvId) {
    const [summary, activePlan] = contextData as [
      { content: string } | null,
      { memory: string | null } | null,
    ];
    if (summary) existingSummary = summary.content;
    if (activePlan?.memory) planMemory = activePlan.memory;
  }

  if (userMemories.length > 0) {
    userMemoryContext = buildMemoryContext(userMemories);
  }

  // ─── Autocompact: check context window ─────────────────

  const systemTokens = estimateTokens(systemPrompt);
  const contextCheck = checkContextWindow(
    messages,
    systemTokens,
    plan.contextWindowSize
  );

  let effectiveMessages = messages;
  let isCompacting = false;

  if (contextCheck.needsCompaction) {
    const { messagesToSummarize, messagesToKeep } = splitMessagesForCompaction(
      messages,
      12
    );

    if (messagesToSummarize.length > 0) {
      effectiveMessages = messagesToKeep;
      isCompacting = true;

      // Fire compaction asynchronously (non-blocking)
      if (reqConvId) {
        compactInBackground(
          reqConvId,
          existingSummary,
          messagesToSummarize,
          plan.tokensPerMessage,
          session.user.id
        );
      }
    }
  }

  // ─── Build enriched system prompt ──────────────────────

  const enrichedSystemPrompt = buildSystemPromptWithContext(
    systemPrompt,
    existingSummary,
    planMemory,
    userMemoryContext
  );

  // ─── Build API messages ────────────────────────────────

  const apiMessages = buildApiMessages(effectiveMessages, attachments, enrichedSystemPrompt);

  // Context info for frontend
  const contextInfo = {
    usagePercent: Math.round(contextCheck.usagePercent * 100),
    totalTokens: contextCheck.totalTokens,
    contextWindowSize: contextCheck.contextWindowSize,
    compacting: isCompacting,
  };

  // Track usage
  const inputChars = messages.reduce(
    (sum: number, m: { content: string }) => sum + (m.content?.length || 0),
    0
  );
  const estimatedTokens = Math.max(100, Math.ceil(inputChars / 3));
  await incrementUsage(session.user.id, estimatedTokens);

  // ─── Moonshot (Kimi K2.5) ──────────────────────────────
  if (effectiveProvider === "deepinfra") {
    const stream = streamMoonshot(apiMessages, {
      maxTokens: plan.tokensPerMessage,
      thinkingEnabled,
      webSearchEnabled,
      contextInfo,
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
    system: enrichedSystemPrompt,
    messages: effectiveMessages,
    temperature: 0.6,
    topP: 0.95,
    maxOutputTokens: plan.tokensPerMessage,
  });

  // Wrap AI SDK text stream with plan detection
  const stream = createPlanDetectorStream(result.textStream, contextInfo);

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
