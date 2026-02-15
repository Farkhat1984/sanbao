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
import { isSystemAgent, resolveAgentId } from "@/lib/system-agents";
import { resolveAgentContext } from "@/lib/tool-resolver";
import { callMcpTool } from "@/lib/mcp-client";
import { resolveModel, type ResolvedModel } from "@/lib/model-router";
import { checkContentFilter } from "@/lib/content-filter";
import { recordRequestDuration } from "@/lib/request-metrics";
import { resolveWithExperiment } from "@/lib/ab-experiment";
import {
  MOONSHOT_CHAT_URL,
  DEFAULT_TEXT_MODEL,
  DEFAULT_TEMPERATURE,
  DEFAULT_TEMPERATURE_COMPACTION,
  DEFAULT_TOP_P,
  DEFAULT_MAX_TOKENS_COMPACTION,
  DEFAULT_PROVIDER,
  CONTEXT_KEEP_LAST_MESSAGES,
} from "@/lib/constants";

const SYSTEM_PROMPT = `Ты — Sanbao, AI ERP-платформа нового поколения для профессионалов. Ты объединяешь мощь нескольких AI-моделей, гибкую систему агентов, инструменты (Tools), скиллы (Skills), плагины (Plugins) и MCP-серверы в единую интеллектуальную среду. Твоя задача — помогать пользователям эффективно решать любые профессиональные задачи: создание документов, анализ данных, написание кода, автоматизация процессов, юридическая работа и многое другое.

АРХИТЕКТУРА ПЛАТФОРМЫ:
Sanbao — модульная AI-система с многоуровневой архитектурой:
- **Агенты** — специализированные AI-персоны с уникальными инструкциями, инструментами и знаниями. У каждого агента свой системный промпт, набор скиллов, инструментов, плагинов и MCP-серверов. Агенты могут иметь файлы знаний для расширения контекста.
- **Инструменты (Tools)** — шаблоны и действия (PROMPT_TEMPLATE, WEBHOOK, URL, FUNCTION). Инструменты автоматизируют типовые операции: генерация документов, вызов API, заполнение шаблонов.
- **Скиллы (Skills)** — специализированные поведенческие модули, внедряющие дополнительные системные инструкции, правила цитирования и юрисдикцию.
- **Плагины (Plugins)** — пакеты, объединяющие инструменты, скиллы и MCP-серверы в готовые решения для конкретных областей.
- **MCP-серверы** — внешние серверы по протоколу Model Context Protocol, расширяющие возможности агента: базы данных, API, файловые системы, специализированные сервисы.
- **Память** — пользовательские предпочтения и стандарты, сохраняемые между сессиями. Система автоматической компактизации контекста с созданием резюме длинных диалогов.
- **Биллинг и планы** — тарифные планы с лимитами на сообщения, агентов, хранилище.

Отвечай точно, профессионально и структурировано. Адаптируй тон под контекст: формальный для юридических и деловых задач, практичный для технических. Когда контекст агента включает специализированные скиллы или инструменты — опирайся на них в первую очередь.

СОЗДАНИЕ ДОКУМЕНТОВ И АРТЕФАКТОВ:
Когда создаёшь объёмный контент (документ, код, анализ), оберни его в тег:
<sanbao-doc type="ТИП" title="Название">
Содержимое в Markdown
</sanbao-doc>
Типы: DOCUMENT, CODE, ANALYSIS.
Используй структурированный Markdown: заголовки, списки, таблицы, **жирный** для ключевых терминов.
НЕ используй для коротких ответов или фрагментов кода менее 10 строк.

СОЗДАНИЕ КОДА:
- Игры, анимации, визуализации — ТОЛЬКО HTML5 Canvas + JavaScript/React (работает в браузере).
- Python (вычисления, данные) — через Pyodide в браузере.
- Код оборачивай в <sanbao-doc type="CODE" title="...">.

РЕДАКТИРОВАНИЕ ДОКУМЕНТОВ:
Для изменения ранее созданного документа используй точечные замены:
<sanbao-edit target="Точное название">
<replace>
<old>точный фрагмент</old>
<new>новый текст</new>
</replace>
</sanbao-edit>
Можно указать несколько блоков <replace>. Используй ТОЛЬКО для уже созданных в этом чате документов.

РЕЖИМ ПЛАНИРОВАНИЯ:
<sanbao-plan> — ТОЛЬКО когда пользователь включил режим планирования через интерфейс (ты получишь отдельную инструкцию).
НЕ генерируй самостоятельно. Если просят "составь план" или "распиши стратегию" — создавай через <sanbao-doc>.
Формат:
<sanbao-plan>
## План
1. Шаг — описание
</sanbao-plan>
После плана — сразу приступай к выполнению.

ЗАДАЧИ:
Создавай чек-лист ТОЛЬКО по явной просьбе пользователя ("сделай чек-лист", "составь to-do").
<sanbao-task title="Название">
- [ ] Шаг
</sanbao-task>

УТОЧНЯЮЩИЕ ВОПРОСЫ:
Перед созданием сложного документа без достаточных деталей — задай уточняющие вопросы:
<sanbao-clarify>
[
  {"id": "1", "question": "Вопрос?", "options": ["Вариант 1", "Вариант 2"]},
  {"id": "2", "question": "Вопрос?", "type": "text", "placeholder": "Укажите..."}
]
</sanbao-clarify>
2-5 вопросов с уникальным id. Тег в конце сообщения. После ответов — сразу создавай документ.

ССЫЛКИ НА СТАТЬИ ЗАКОНОВ:
Когда ссылаешься на статью закона, используй формат markdown-ссылки:
[ст. {номер} {код}](article://{code_name}/{номер})
Примеры:
- [ст. 188 УК РК](article://criminal_code/188) — Уголовный кодекс
- [ст. 15 ГК РК](article://civil_code/15) — Гражданский кодекс
- [ст. 73 КоАП РК](article://administrative_code/73) — Кодекс об административных правонарушениях
- [ст. 152 НК РК](article://tax_code/152) — Налоговый кодекс
- [ст. 87 ТК РК](article://labor_code/87) — Трудовой кодекс
- [ст. 44 ЗК РК](article://land_code/44) — Земельный кодекс
- [ст. 120 ЭК РК](article://environmental_code/120) — Экологический кодекс
- [ст. 30 ПК РК](article://business_code/30) — Предпринимательский кодекс
- [ст. 55 ГПК РК](article://civil_procedure_code/55) — Гражданский процессуальный кодекс
- [ст. 68 УПК РК](article://criminal_procedure_code/68) — Уголовно-процессуальный кодекс
Пользователь сможет кликнуть на ссылку и увидеть полный текст статьи. Всегда используй этот формат при упоминании конкретных статей.

ПРАВИЛО ОДНОГО ДЕЙСТВИЯ:
В каждом ответе — МАКСИМУМ ОДИН специальный тег: <sanbao-clarify>, <sanbao-plan>, <sanbao-task> или <sanbao-doc>/<sanbao-edit>. Не комбинируй.`;

// Resolved dynamically via model-router; kept as fallback constant
const MOONSHOT_URL_FALLBACK = MOONSHOT_CHAT_URL;

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

    // Skip assistant messages with empty content (streaming placeholders)
    if (msg.role === "assistant" && !msg.content.trim()) continue;

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
  userId: string,
  textModel?: ResolvedModel | null
) {
  try {
    const compactionPrompt = buildCompactionPrompt(existingSummary, messagesToSummarize);

    const model = textModel || await resolveModel("TEXT");
    const apiUrl = model
      ? `${model.provider.baseUrl}/chat/completions`
      : MOONSHOT_URL_FALLBACK;
    const apiKey = model?.provider.apiKey || process.env.MOONSHOT_API_KEY || "";
    const modelId = model?.modelId || DEFAULT_TEXT_MODEL;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          { role: "system", content: "Ты — ассистент для сжатия контекста разговора." },
          { role: "user", content: compactionPrompt },
        ],
        max_tokens: Math.min(maxTokens, DEFAULT_MAX_TOKENS_COMPACTION),
        temperature: DEFAULT_TEMPERATURE_COMPACTION,
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

interface McpToolContext {
  url: string;
  transport: "SSE" | "STREAMABLE_HTTP";
  apiKey: string | null;
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

function streamMoonshot(
  apiMessages: Array<Record<string, unknown>>,
  options: {
    maxTokens: number;
    thinkingEnabled: boolean;
    webSearchEnabled: boolean;
    mcpTools?: McpToolContext[];
    contextInfo?: { usagePercent: number; totalTokens: number; contextWindowSize: number; compacting: boolean };
    textModel?: ResolvedModel | null;
  }
) {
  const encoder = new TextEncoder();
  const { maxTokens, thinkingEnabled, webSearchEnabled, mcpTools = [], contextInfo, textModel } = options;

  const apiUrl = textModel
    ? `${textModel.provider.baseUrl}/chat/completions`
    : MOONSHOT_URL_FALLBACK;
  const apiKey = textModel?.provider.apiKey || process.env.MOONSHOT_API_KEY || "";
  const modelId = textModel?.modelId || DEFAULT_TEXT_MODEL;

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
          const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: modelId,
              messages: currentMessages,
              max_tokens: maxTokens,
              temperature: thinkingEnabled ? 1.0 : DEFAULT_TEMPERATURE,
              top_p: DEFAULT_TOP_P,
              stream: true,
              ...((webSearchEnabled || mcpTools.length > 0)
                ? {
                    tools: [
                      ...(webSearchEnabled ? [WEB_SEARCH_BUILTIN] : []),
                      ...mcpTools.map((t) => ({
                        type: "function" as const,
                        function: {
                          name: t.name,
                          description: t.description,
                          parameters: t.inputSchema,
                        },
                      })),
                    ],
                  }
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
              if (!insidePlan && planBuffer.includes("<sanbao-plan>")) {
                const idx = planBuffer.indexOf("<sanbao-plan>");
                const before = planBuffer.slice(0, idx);
                if (before) {
                  controller.enqueue(
                    encoder.encode(JSON.stringify({ t: "c", v: before }) + "\n")
                  );
                }
                planBuffer = planBuffer.slice(idx + "<sanbao-plan>".length);
                insidePlan = true;
              }

              if (insidePlan) {
                // Check for plan closing tag
                if (planBuffer.includes("</sanbao-plan>")) {
                  const idx = planBuffer.indexOf("</sanbao-plan>");
                  const planText = planBuffer.slice(0, idx);
                  if (planText) {
                    controller.enqueue(
                      encoder.encode(JSON.stringify({ t: "p", v: planText }) + "\n")
                    );
                  }
                  planBuffer = planBuffer.slice(idx + "</sanbao-plan>".length);
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
                // Keep tail that could be a partial "<sanbao-plan>" tag
                const TAG = "<sanbao-plan>";
                let safeFlush = planBuffer;
                let keepTail = "";
                for (let k = 1; k < TAG.length; k++) {
                  if (planBuffer.endsWith(TAG.slice(0, k))) {
                    safeFlush = planBuffer.slice(0, -k);
                    keepTail = planBuffer.slice(-k);
                    break;
                  }
                }
                if (safeFlush) {
                  controller.enqueue(
                    encoder.encode(JSON.stringify({ t: "c", v: safeFlush }) + "\n")
                  );
                }
                planBuffer = keepTail;
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

            // Build a map of MCP tool names for quick lookup
            const mcpToolMap = new Map(mcpTools.map((t) => [t.name, t]));

            for (const tc of collectedCalls) {
              const mcpDef = mcpToolMap.get(tc.function.name);
              if (mcpDef) {
                // MCP tool call — execute via MCP client
                let args: Record<string, unknown> = {};
                try {
                  args = JSON.parse(tc.function.arguments || "{}");
                } catch {
                  // fallback empty
                }
                const mcpResult = await callMcpTool(
                  mcpDef.url,
                  mcpDef.transport,
                  mcpDef.apiKey,
                  tc.function.name,
                  args
                );
                currentMessages.push({
                  role: "tool",
                  tool_call_id: tc.id,
                  content: mcpResult.error
                    ? `Error: ${mcpResult.error}`
                    : mcpResult.result,
                });
              } else {
                // Built-in tool (web search) — pass arguments as content
                currentMessages.push({
                  role: "tool",
                  tool_call_id: tc.id,
                  content: tc.function.arguments,
                });
              }
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

          if (!insidePlan && planBuffer.includes("<sanbao-plan>")) {
            const idx = planBuffer.indexOf("<sanbao-plan>");
            const before = planBuffer.slice(0, idx);
            if (before) {
              controller.enqueue(
                encoder.encode(JSON.stringify({ t: "c", v: before }) + "\n")
              );
            }
            planBuffer = planBuffer.slice(idx + "<sanbao-plan>".length);
            insidePlan = true;
          }

          if (insidePlan) {
            if (planBuffer.includes("</sanbao-plan>")) {
              const idx = planBuffer.indexOf("</sanbao-plan>");
              const planText = planBuffer.slice(0, idx);
              if (planText) {
                controller.enqueue(
                  encoder.encode(JSON.stringify({ t: "p", v: planText }) + "\n")
                );
              }
              planBuffer = planBuffer.slice(idx + "</sanbao-plan>".length);
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
            // Keep tail that could be a partial "<sanbao-plan>" tag
            const TAG = "<sanbao-plan>";
            let safeFlush = planBuffer;
            let keepTail = "";
            for (let k = 1; k < TAG.length; k++) {
              if (planBuffer.endsWith(TAG.slice(0, k))) {
                safeFlush = planBuffer.slice(0, -k);
                keepTail = planBuffer.slice(-k);
                break;
              }
            }
            if (safeFlush) {
              controller.enqueue(
                encoder.encode(JSON.stringify({ t: "c", v: safeFlush }) + "\n")
              );
            }
            planBuffer = keepTail;
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
  const _requestStart = Date.now();

  const session = await auth();
  if (!session?.user?.id) {
    recordRequestDuration("/api/chat", Date.now() - _requestStart);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const {
    messages,
    provider = DEFAULT_PROVIDER,
    agentId,
    skillId,
    thinkingEnabled = true,
    webSearchEnabled = false,
    planningEnabled = false,
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

  const isAdmin = session.user.role === "ADMIN";

  // Skip all limits for admins
  if (!isAdmin) {
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
  }

  // Content filter check on last user message
  const lastUserMsg = [...messages].reverse().find((m: { role: string }) => m.role === "user");
  if (lastUserMsg) {
    const filterResult = await checkContentFilter(
      typeof lastUserMsg.content === "string" ? lastUserMsg.content : JSON.stringify(lastUserMsg.content)
    );
    if (filterResult.blocked) {
      return NextResponse.json(
        { error: "Сообщение содержит запрещённый контент и не может быть отправлено." },
        { status: 400 }
      );
    }
  }

  // Build system prompt and determine provider
  let systemPrompt = SYSTEM_PROMPT;
  let effectiveProvider = provider;
  const agentMcpTools: McpToolContext[] = [];

  if (agentId) {
    // Resolve legacy IDs (e.g. "system-femida" → "system-femida-agent")
    const resolvedId = resolveAgentId(agentId);

    // Use unified resolver for ALL agents (system + user)
    const ctx = await resolveAgentContext(resolvedId);

    if (ctx.systemPrompt) {
      systemPrompt = ctx.systemPrompt + "\n\n" + SYSTEM_PROMPT + ctx.skillPrompts.join("");
      agentMcpTools.push(...ctx.mcpTools);
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

  // A/B experiment: allow overriding global system prompt
  {
    const ab = await resolveWithExperiment("global_system_prompt", systemPrompt, session.user.id);
    if (ab.experimentId) {
      systemPrompt = ab.value;
    }
  }

  if (planningEnabled) {
    systemPrompt +=
      "\n\nВАЖНО: Пользователь включил режим планирования. ОБЯЗАТЕЛЬНО начни ответ с подробного плана в теге <sanbao-plan>. Распиши все шаги, подзадачи и порядок действий. Это критически важно — пользователь ожидает структурированный план ПЕРЕД основным ответом.";
  }

  if (webSearchEnabled) {
    systemPrompt +=
      "\n\nУ тебя есть доступ к веб-поиску. Используй его когда нужно найти актуальную информацию, последние изменения в законодательстве, судебную практику или новости.\n\nВАЖНО: Когда используешь веб-поиск, ОБЯЗАТЕЛЬНО в конце ответа добавь раздел «Источники:» со списком URL-ссылок откуда была взята информация. Формат:\n\nИсточники:\n- [Название](URL)\n- [Название](URL)";
  }

  // ─── Load context from DB (summary + plan memory + user memory) ──

  let existingSummary: string | null = null;
  let planMemory: string | null = null;
  let userMemoryContext: string | null = null;

  const [contextData, userMemories, activeTasks] = await Promise.all([
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
    reqConvId
      ? prisma.task.findMany({
          where: { conversationId: reqConvId, status: "IN_PROGRESS" },
          select: { title: true, steps: true, progress: true },
        })
      : Promise.resolve([]),
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

  // Build tasks context for re-injection (survives compaction)
  let tasksContext: string | null = null;
  if (activeTasks.length > 0) {
    tasksContext = activeTasks.map((t) => {
      const steps = t.steps as Array<{ text: string; done: boolean }>;
      const done = steps.filter((s) => s.done).map((s) => `  ✓ ${s.text}`);
      const pending = steps.filter((s) => !s.done).map((s) => `  ○ ${s.text}`);
      return `**${t.title}** (${t.progress}%)\n${done.join("\n")}\n${pending.join("\n")}`;
    }).join("\n\n");
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
      CONTEXT_KEEP_LAST_MESSAGES
    );

    if (messagesToSummarize.length > 0) {
      effectiveMessages = messagesToKeep;
      isCompacting = true;

      // Fire compaction asynchronously (non-blocking)
      if (reqConvId) {
        const compactModel = await resolveModel("TEXT", plan.id);
        compactInBackground(
          reqConvId,
          existingSummary,
          messagesToSummarize,
          plan.tokensPerMessage,
          session.user.id,
          compactModel
        );
      }
    }
  }

  // ─── Build enriched system prompt ──────────────────────

  const enrichedSystemPrompt = buildSystemPromptWithContext(
    systemPrompt,
    existingSummary,
    planMemory,
    userMemoryContext,
    tasksContext
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

  // ─── Resolve text model from DB ────────────────────────
  const textModel = await resolveModel("TEXT", plan.id);

  // ─── Moonshot-compatible providers (custom SSE streaming) ─
  if (effectiveProvider === "deepinfra") {
    const stream = streamMoonshot(apiMessages, {
      maxTokens: plan.tokensPerMessage,
      thinkingEnabled,
      webSearchEnabled,
      mcpTools: agentMcpTools,
      contextInfo,
      textModel,
    });

    recordRequestDuration("/api/chat", Date.now() - _requestStart);
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
    temperature: DEFAULT_TEMPERATURE,
    topP: DEFAULT_TOP_P,
    maxOutputTokens: plan.tokensPerMessage,
  });

  // Wrap AI SDK text stream with plan detection
  const stream = createPlanDetectorStream(result.textStream, contextInfo);

  recordRequestDuration("/api/chat", Date.now() - _requestStart);
  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
